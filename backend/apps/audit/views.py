from django.apps import apps
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response

from apps.authentification.mixins import ParamFilterMixin
from apps.authentification.permissions import HasPrivilege

from .models import AuditLog
from .registry import AUDITED
from .serializers import AuditLogSerializer


class AuditLogViewSet(
    ParamFilterMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Lecture seule. Historique d'un document : ?table=facture&objet=12"""
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer
    permission_classes = [HasPrivilege]
    filter_backends = [SearchFilter, OrderingFilter]
    privilege_map = {'list': 'audit.view', 'retrieve': 'audit.view', 'tables': 'audit.view'}
    search_fields = ['identifiant_utilisateur', 'reference', 'table_nom']
    query_filters = {
        'table': 'table_nom', 'operation': 'operation', 'objet': 'id_objet',
        'reference': 'reference', 'utilisateur': 'identifiant_utilisateur',
        'id_utilisateur': 'id_utilisateur',
        'du': 'date_audit__date__gte', 'au': 'date_audit__date__lte',
    }

    @action(detail=False, methods=['get'])
    def tables(self, request):
        """Tables auditées (pour alimenter un filtre côté frontend)."""
        return Response(sorted(apps.get_model(l)._meta.db_table for l in AUDITED))