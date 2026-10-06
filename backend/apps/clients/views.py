from django.db.models import ProtectedError
from rest_framework import status, viewsets
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response

from apps.authentification.permissions import HasPrivilege, crud_map
from .permissions import types_geres, types_visibles
from .models import Client, Organisme, SolvabiliteClient
from .serializers import (
    ClientSerializer, OrganismeSerializer, SolvabiliteClientSerializer,
)


class BaseClientViewSet(viewsets.ModelViewSet):
    permission_classes = [HasPrivilege]
    filter_backends = [SearchFilter, OrderingFilter]
    parent_filters = {}
    query_filters = {}

    def get_queryset(self):
        qs = super().get_queryset()
        for param, field in self.parent_filters.items():
            value = self.request.query_params.get(param)
            if value:
                qs = qs.filter(**{field: value})
        for param, field in self.query_filters.items():
            value = self.request.query_params.get(param)
            if value not in (None, ''):
                qs = qs.filter(**{field: value})
        return qs

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {'detail': 'Suppression impossible : des éléments dépendants y sont rattachés.'},
                status=status.HTTP_409_CONFLICT,
            )


class OrganismeViewSet(BaseClientViewSet):
    queryset = Organisme.objects.all()
    serializer_class = OrganismeSerializer
    privilege_map = crud_map('organisme')
    search_fields = ['nom_organisme', 'code_institutionnel']


def _tout_privilege(action):
    return [f'client.{action}', f'client_simple.{action}']


class ClientViewSet(BaseClientViewSet):
    queryset = Client.objects.select_related(
        'fokontany__commune__district__region', 'organisme', 'solvabilite'
    )
    serializer_class = ClientSerializer
    # « Au moins un de ces privilèges » ; le détail par type est contrôlé dans le serializer
    privilege_map = {
        'list': _tout_privilege('view'),
        'retrieve': _tout_privilege('view'),
        'create': _tout_privilege('create'),
        'update': _tout_privilege('update'),
        'partial_update': _tout_privilege('update'),
        'destroy': _tout_privilege('delete'),
    }
    search_fields = ['nom_client', 'code_soa', 'cin_ou_nif', 'telephone', 'ville']
    ordering_fields = ['nom_client', 'type_client', 'id_client', 'ville']
    query_filters = {
        'type_client': 'type_client',
        'organisme': 'organisme_id',
        'fokontany': 'fokontany_id',
        'commune': 'fokontany__commune_id',
        'district': 'fokontany__commune__district_id',
        'region': 'fokontany__commune__district__region_id',
    }

    def get_queryset(self):
        qs = super().get_queryset().filter(type_client__in=types_visibles(self.request.user))
        if self.request.query_params.get('soa') == 'true':
            qs = qs.filter(type_client__in=[Client.TypeClient.MINISTERE, Client.TypeClient.CTD])
        return qs

    def destroy(self, request, *args, **kwargs):
        client = self.get_object()
        if client.type_client not in types_geres(request.user, 'delete'):
            return Response(
                {'detail': "Votre rôle ne permet pas de supprimer ce type de client."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().destroy(request, *args, **kwargs)


class SolvabiliteViewSet(BaseClientViewSet):
    queryset = SolvabiliteClient.objects.select_related('client')
    serializer_class = SolvabiliteClientSerializer
    privilege_map = crud_map('solvabilite')
    search_fields = ['client__nom_client']
    parent_filters = {
        'client': 'client_id',
        'statut_blocage': 'statut_blocage',
    }
