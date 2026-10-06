from django.db.models import ProtectedError
from rest_framework import status, viewsets
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response

from apps.authentification.permissions import HasPrivilege, crud_map

from .models import Commune, District, Fokontany, Province, Region
from .serializers import (
    CommuneSerializer, DistrictSerializer, FokontanySerializer,
    ProvinceSerializer, RegionSerializer,
)


class TerritoireViewSet(viewsets.ModelViewSet):
    """
    Base commune :
    - permission HasPrivilege (privilege_map défini dans chaque sous-classe)
    - recherche (?search=) et tri (?ordering=)
    - filtres par parent via `parent_filters` : {paramètre_url: champ_orm}
    - suppression protégée : 409 si des enregistrements enfants existent
    """
    permission_classes = [HasPrivilege]
    filter_backends = [SearchFilter, OrderingFilter]
    parent_filters = {}

    def get_queryset(self):
        qs = super().get_queryset()
        for param, field in self.parent_filters.items():
            value = self.request.query_params.get(param)
            if value:
                qs = qs.filter(**{field: value})
        return qs

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {'detail': "Suppression impossible : des éléments dépendants y sont rattachés."},
                status=status.HTTP_409_CONFLICT,
            )


class ProvinceViewSet(TerritoireViewSet):
    queryset = Province.objects.all()
    serializer_class = ProvinceSerializer
    privilege_map = crud_map('province')
    search_fields = ['nom_province']


class RegionViewSet(TerritoireViewSet):
    queryset = Region.objects.select_related('province')
    serializer_class = RegionSerializer
    privilege_map = crud_map('region')
    search_fields = ['nom_region']
    parent_filters = {'province': 'province_id'}


class DistrictViewSet(TerritoireViewSet):
    queryset = District.objects.select_related('region')
    serializer_class = DistrictSerializer
    privilege_map = crud_map('district')
    search_fields = ['nom_district']
    parent_filters = {'region': 'region_id', 'province': 'region__province_id'}


class CommuneViewSet(TerritoireViewSet):
    queryset = Commune.objects.select_related('district')
    serializer_class = CommuneSerializer
    privilege_map = crud_map('commune')
    search_fields = ['nom_commune']
    parent_filters = {
        'district': 'district_id',
        'region': 'district__region_id',
        'type_commune': 'type_commune',
    }


class FokontanyViewSet(TerritoireViewSet):
    queryset = Fokontany.objects.select_related(
        'commune__district__region__province'
    )
    serializer_class = FokontanySerializer
    privilege_map = crud_map('fokontany')
    search_fields = ['nom_fokontany']
    parent_filters = {
        'commune': 'commune_id',
        'district': 'commune__district_id',
        'region': 'commune__district__region_id',
    }