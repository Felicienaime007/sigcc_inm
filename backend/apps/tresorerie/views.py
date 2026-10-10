from django.db.models import Count
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response

from apps.authentification.mixins import ParamFilterMixin, ProtectedDeleteMixin
from apps.authentification.permissions import HasPrivilege, crud_map

from .models import (
    NB_FEUILLES, VOLETS, ArreteCaisse, Caisse, LivreCaisse, LivreQuittance,
    Quittance, Reglement, RemiseBanque,
)
from .serializers import (
    ArreteCaisseSerializer, CaisseSerializer, LivreCaisseSerializer,
    LivreQuittanceSerializer, QuittanceSerializer, ReglementSerializer,
    RemiseBanqueSerializer,
)
from . import services


class BaseViewSet(ParamFilterMixin, ProtectedDeleteMixin, viewsets.ModelViewSet):
    permission_classes = [HasPrivilege]
    filter_backends = [SearchFilter, OrderingFilter]


class LectureCreationViewSet(
    ParamFilterMixin,
    mixins.CreateModelMixin, mixins.ListModelMixin,
    mixins.RetrieveModelMixin, viewsets.GenericViewSet,
):
    """Écritures figées : pas de modification ni de suppression."""
    permission_classes = [HasPrivilege]
    filter_backends = [SearchFilter, OrderingFilter]


class CaisseViewSet(BaseViewSet):
    queryset = Caisse.objects.all()
    serializer_class = CaisseSerializer
    privilege_map = crud_map('caisse')
    search_fields = ['code_caisse', 'libelle_caisse']


class LivreQuittanceViewSet(BaseViewSet):
    queryset = LivreQuittance.objects.annotate(nb_utilisees=Count('quittances'))
    serializer_class = LivreQuittanceSerializer
    privilege_map = {**crud_map('livre_quittance'), 'prochain': 'livre_quittance.view'}
    search_fields = ['numero_livre']
    query_filters = {'statut': 'statut_livre', 'annee': 'annee_ouverture'}

    @action(detail=True, methods=['get'])
    def prochain(self, request, pk=None):
        """Suggère le prochain volet libre (ordre : feuille 1 A..E, feuille 2 A..E, ...)."""
        livre = self.get_object()
        utilises = set(livre.quittances.values_list('num_feuille', 'attribut_volet'))
        for feuille in range(1, NB_FEUILLES + 1):
            for volet in VOLETS:
                if (feuille, volet) not in utilises:
                    return Response({'num_feuille': feuille, 'attribut_volet': volet})
        return Response({'detail': "Carnet épuisé."}, status=status.HTTP_409_CONFLICT)


class QuittanceViewSet(
    ParamFilterMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Lecture seule : une quittance naît d'un règlement en caisse."""
    queryset = Quittance.objects.select_related(
        'livre', 'caisse', 'reglement__facture'
    )
    serializer_class = QuittanceSerializer
    permission_classes = [HasPrivilege]
    filter_backends = [SearchFilter, OrderingFilter]
    privilege_map = {'list': 'quittance.view', 'retrieve': 'quittance.view'}
    search_fields = ['livre__numero_livre', 'reglement__facture__num_facture']
    query_filters = {
        'livre': 'livre_id', 'caisse': 'caisse_id', 'statut': 'statut',
        'facture': 'reglement__facture_id', 'annee': 'date_emission__year',
    }


class ReglementViewSet(LectureCreationViewSet):
    queryset = Reglement.objects.select_related(
        'facture', 'quittance__livre', 'quittance__caisse'
    )
    serializer_class = ReglementSerializer
    privilege_map = {
        'list': 'reglement.view', 'retrieve': 'reglement.view', 'create': 'reglement.create',
        'annuler': 'reglement.annuler',
    }
    search_fields = ['num_virement_tresor', 'facture__num_facture']
    query_filters = {
        'facture': 'facture_id', 'mode': 'mode_reglement',
        'statut': 'statut',
        'annee': 'date_reglement__year',
        'du': 'date_reglement__date__gte', 'au': 'date_reglement__date__lte',
    }

    @action(detail=True, methods=['post'])
    def annuler(self, request, pk=None):
        """Contre-passe un règlement saisi par erreur : body {"motif": "..."}."""
        reglement = self.get_object()
        services.contrepasser_reglement(reglement, request.data.get('motif'))
        return Response(self.get_serializer(self.get_object()).data)


class LivreCaisseViewSet(LectureCreationViewSet):
    queryset = LivreCaisse.objects.select_related('caisse', 'reglement__facture')
    serializer_class = LivreCaisseSerializer
    privilege_map = {
        'list': 'livre_caisse.view', 'retrieve': 'livre_caisse.view',
        'create': 'livre_caisse.create',
    }
    search_fields = ['reference', 'reglement__facture__num_facture']
    query_filters = {
        'caisse': 'caisse_id', 'type': 'type_operation',
        'du': 'date_operation__date__gte', 'au': 'date_operation__date__lte',
    }


class ArreteCaisseViewSet(BaseViewSet):
    """Arrêtés de caisse journaliers : brouillon modifiable, validation figeante."""
    queryset = ArreteCaisse.objects.select_related('caisse').prefetch_related('remises')
    serializer_class = ArreteCaisseSerializer
    privilege_map = {
        **crud_map('arrete_caisse'),
        'valider': 'arrete_caisse.valider',
    }
    search_fields = ['caisse__code_caisse']
    query_filters = {
        'caisse': 'caisse_id', 'statut': 'statut',
        'date': 'date_arrete', 'annee': 'date_arrete__year',
    }

    def perform_update(self, serializer):
        if serializer.instance.statut != ArreteCaisse.Statut.BROUILLON:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'detail': "Un arrêté validé n'est plus modifiable."})
        serializer.save()

    def perform_destroy(self, instance):
        if instance.statut != ArreteCaisse.Statut.BROUILLON:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'detail': "Un arrêté validé ne peut pas être supprimé."})
        instance.delete()

    @action(detail=True, methods=['post'])
    def valider(self, request, pk=None):
        arrete = self.get_object()
        services.valider_arrete(arrete)
        return Response(self.get_serializer(self.get_object()).data)


class RemiseBanqueViewSet(BaseViewSet):
    """Remises en banque : préparation puis exécution (sortie de caisse)."""
    queryset = RemiseBanque.objects.select_related('caisse', 'arrete')
    serializer_class = RemiseBanqueSerializer
    privilege_map = {
        **crud_map('remise_banque'),
        'remettre': 'remise_banque.remettre',
    }
    search_fields = ['reference_bordereau', 'caisse__code_caisse']
    query_filters = {
        'caisse': 'caisse_id', 'statut': 'statut',
        'annee': 'date_remise__year',
        'du': 'date_remise__date__gte', 'au': 'date_remise__date__lte',
    }

    def perform_update(self, serializer):
        if serializer.instance.statut != RemiseBanque.Statut.PREPAREE:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'detail': "Une remise effectuée n'est plus modifiable."})
        serializer.save()

    def perform_destroy(self, instance):
        if instance.statut != RemiseBanque.Statut.PREPAREE:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'detail': "Une remise effectuée ne peut pas être supprimée."})
        instance.delete()

    @action(detail=True, methods=['post'])
    def remettre(self, request, pk=None):
        remise = self.get_object()
        services.remettre_en_banque(remise)
        return Response(self.get_serializer(self.get_object()).data)