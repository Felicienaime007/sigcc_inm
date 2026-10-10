from django.db import transaction
from django.db.models import Count, Sum, DecimalField, Q, Value
from django.db.models.functions import Coalesce
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response
from decimal import Decimal
from apps.authentification.mixins import ParamFilterMixin, ProtectedDeleteMixin
from apps.authentification.permissions import HasPrivilege, crud_map

from .models import (
    Budget, EngagementBudget, LigneBudgetaire, PrevisionBudgetaire, TypeFinancement,
)
from .serializers import (
    BudgetSerializer, EngagementBudgetSerializer, LigneBudgetaireSerializer,
    PrevisionBudgetaireSerializer, TypeFinancementSerializer,
)


class BaseViewSet(ParamFilterMixin, ProtectedDeleteMixin, viewsets.ModelViewSet):
    permission_classes = [HasPrivilege]
    filter_backends = [SearchFilter, OrderingFilter]


class TypeFinancementViewSet(BaseViewSet):
    queryset = TypeFinancement.objects.all()
    serializer_class = TypeFinancementSerializer
    privilege_map = crud_map('type_financement')
    search_fields = ['libelle_financement']


class BudgetViewSet(BaseViewSet):
    queryset = Budget.objects.select_related('organisme').annotate(
        nb_lignes=Count('lignes'),
        total_disponible=Sum('lignes__montant_disponible'),
        # Engagé sur toutes les lignes (même au-delà de la 1000e affichée)
        total_engage=Coalesce(
            Sum('lignes__engagements__montant_engage',
                filter=Q(lignes__engagements__statut_engagement__in=['VISE', 'SOLDE'])),
            Value(Decimal('0')),
            output_field=DecimalField(max_digits=17, decimal_places=2),
        ),
    )
    serializer_class = BudgetSerializer
    privilege_map = crud_map('budget')
    search_fields = ['organisme__nom_organisme', 'organisme__code_institutionnel']
    query_filters = {'organisme': 'organisme_id', 'annee': 'annee_budgetaire'}


class LigneBudgetaireViewSet(BaseViewSet):
    queryset = LigneBudgetaire.objects.select_related(
        'budget__organisme', 'type_financement'
    ).annotate(
        nb_engagements=Count('engagements'),
        total_engage=Coalesce(
            Sum('engagements__montant_engage',
                filter=Q(engagements__statut_engagement__in=['VISE', 'SOLDE'])),
            Value(Decimal('0')),
            output_field=DecimalField(max_digits=17, decimal_places=2),
        ),
    )
    serializer_class = LigneBudgetaireSerializer
    privilege_map = crud_map('ligne_budgetaire')
    search_fields = ['code_article', 'libelle_ligne']
    query_filters = {
        'budget': 'budget_id',
        'organisme': 'budget__organisme_id',
        'annee': 'budget__annee_budgetaire',
        'type_financement': 'type_financement_id',
    }


class PrevisionBudgetaireViewSet(BaseViewSet):
    queryset = PrevisionBudgetaire.objects.select_related('ligne_budget')
    serializer_class = PrevisionBudgetaireSerializer
    privilege_map = crud_map('prevision')
    search_fields = ['periode', 'ligne_budget__code_article']
    query_filters = {
        'ligne_budget': 'ligne_budget_id',
        'budget': 'ligne_budget__budget_id',
        'periode': 'periode',
    }


class EngagementBudgetViewSet(
    ParamFilterMixin,
    mixins.CreateModelMixin, mixins.ListModelMixin,
    mixins.RetrieveModelMixin, mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Pas de DELETE : un engagement visé se désengage avec l'action `annuler`."""
    queryset = EngagementBudget.objects.select_related(
        'client', 'ligne_budget__budget__organisme', 'commande'
    )

    def get_queryset(self):
        qs = super().get_queryset()
        # ?libre=true : engagements pas encore rattachés à une commande
        if self.request.query_params.get('libre') == 'true':
            qs = qs.filter(commande__isnull=True)
        return qs
    serializer_class = EngagementBudgetSerializer
    permission_classes = [HasPrivilege]
    filter_backends = [SearchFilter, OrderingFilter]
    privilege_map = {
        'list': 'engagement.view',
        'retrieve': 'engagement.view',
        'create': 'engagement.create',
        'update': 'engagement.update',
        'partial_update': 'engagement.update',
        'annuler': 'engagement.update',
    }
    search_fields = ['num_engagement_cf', 'client__nom_client', 'client__code_soa']
    query_filters = {
        'client': 'client_id',
        'ligne_budget': 'ligne_budget_id',
        'organisme': 'ligne_budget__budget__organisme_id',
        'annee': 'ligne_budget__budget__annee_budgetaire',
        'statut': 'statut_engagement',
    }

    @action(detail=True, methods=['post'])
    def annuler(self, request, pk=None):
        self.get_object()   # 404 si absent
        with transaction.atomic():
            eng = EngagementBudget.objects.select_for_update().get(pk=pk)
            if hasattr(eng, 'commande'):
                return Response(
                    {'detail': "Cet engagement est rattaché à une commande : annulez d'abord la commande."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            ligne = LigneBudgetaire.objects.select_for_update().get(pk=eng.ligne_budget_id)
            ligne.montant_disponible += eng.montant_engage
            ligne.save(update_fields=['montant_disponible'])
            eng.statut_engagement = EngagementBudget.Statut.ANNULE
            eng.save(update_fields=['statut_engagement'])
        return Response(self.get_serializer(self.get_object()).data)