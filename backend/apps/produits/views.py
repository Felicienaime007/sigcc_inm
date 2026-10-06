from django.db import transaction
from django.db.models import Count
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response

from apps.authentification.mixins import ParamFilterMixin, ProtectedDeleteMixin
from apps.authentification.permissions import HasPrivilege, crud_map
from rest_framework.exceptions import ValidationError

from apps.stock.models import Emplacement, MouvementStock
from apps.stock.services import emplacement_par_defaut, entree
from .models import CategorieProduit, ConfigSerieDocument, LotLancementSerie, ProduitFini
from .serializers import (
    CategorieProduitSerializer, ConfigSerieSerializer,
    LotLancementSerieSerializer, ProduitFiniSerializer,
)

Statut = LotLancementSerie.Statut


class BaseViewSet(ParamFilterMixin, ProtectedDeleteMixin, viewsets.ModelViewSet):
    permission_classes = [HasPrivilege]
    filter_backends = [SearchFilter, OrderingFilter]


class CategorieProduitViewSet(BaseViewSet):
    queryset = CategorieProduit.objects.annotate(nb_produits=Count('produits'))
    serializer_class = CategorieProduitSerializer
    privilege_map = crud_map('categorie')
    search_fields = ['libelle_categorie']


class ConfigSerieViewSet(BaseViewSet):
    queryset = ConfigSerieDocument.objects.select_related('produit').annotate(
        nb_lots=Count('lots')
    )
    serializer_class = ConfigSerieSerializer
    privilege_map = crud_map('config_serie')
    search_fields = ['prefixe_courant', 'produit__code_produit']


class ProduitFiniViewSet(BaseViewSet):
    queryset = ProduitFini.objects.select_related('categorie', 'config')
    serializer_class = ProduitFiniSerializer
    privilege_map = crud_map('produit')
    search_fields = ['code_produit', 'designation']
    ordering_fields = ['code_produit', 'designation', 'prix_tarif']
    query_filters = {'categorie': 'categorie_id'}

    def get_queryset(self):
        qs = super().get_queryset()
        serie = self.request.query_params.get('en_serie')
        if serie in ('true', 'false'):
            qs = qs.filter(config__isnull=(serie == 'false'))
        return qs


class LotLancementSerieViewSet(
    ParamFilterMixin,
    mixins.CreateModelMixin, mixins.ListModelMixin,
    mixins.RetrieveModelMixin, viewsets.GenericViewSet,
):
    """Pas de PUT/PATCH/DELETE : un lot évolue uniquement par ses actions."""
    queryset = LotLancementSerie.objects.select_related('produit', 'config')
    serializer_class = LotLancementSerieSerializer
    permission_classes = [HasPrivilege]
    filter_backends = [SearchFilter, OrderingFilter]
    privilege_map = {
        'list': 'lot.view', 'retrieve': 'lot.view', 'create': 'lot.create',
        'demarrer': 'lot.update', 'terminer': 'lot.update', 'annuler': 'lot.update',
    }
    search_fields = ['num_lot', 'produit__code_produit', 'produit__designation']
    query_filters = {'produit': 'produit_id', 'config': 'config_id', 'statut': 'statut_prod'}

    @staticmethod
    def _emplacement(lot, emplacement_id):
        if emplacement_id not in (None, ''):
            try:
                emp = Emplacement.objects.filter(pk=int(emplacement_id)).first()
            except (TypeError, ValueError):
                emp = None
            if emp is None:
                raise ValidationError({'emplacement': "Emplacement introuvable."})
            return emp
        emp = emplacement_par_defaut(lot.produit_id)
        if emp is None:
            raise ValidationError({
                'emplacement': "Précisez l'emplacement de stockage ({\"emplacement\": id})."
            })
        return emp

    def _transition(self, pk, autorises, nouveau, message, emplacement_id=None):
        with transaction.atomic():
            lot = LotLancementSerie.objects.select_for_update().get(pk=pk)
            if lot.statut_prod not in autorises:
                return None, Response({'detail': message}, status=status.HTTP_400_BAD_REQUEST)
            lot.statut_prod = nouveau
            lot.save(update_fields=['statut_prod'])
            if nouveau == Statut.ANNULE:
                config = ConfigSerieDocument.objects.select_for_update().get(pk=lot.config_id)
                if config.dernier_numero_valide == lot.num_fin:
                    config.dernier_numero_valide = lot.num_debut - 1
                    config.save(update_fields=['dernier_numero_valide'])
            if nouveau == Statut.TERMINE:
                emp = self._emplacement(lot, emplacement_id)
                entree(lot.produit_id, lot.quantite_lancee, emp,
                       MouvementStock.Type.ENTREE_PRODUCTION, reference=lot.num_lot)
        return lot, None

    def _respond(self, pk, autorises, nouveau, message, emplacement_id=None):
        self.get_object()   # 404 si absent
        lot, erreur = self._transition(pk, autorises, nouveau, message, emplacement_id)
        return erreur or Response(self.get_serializer(self.get_object()).data)

    @action(detail=True, methods=['post'])
    def demarrer(self, request, pk=None):
        return self._respond(pk, [Statut.PLANIFIE], Statut.EN_COURS,
                             "Seul un lot PLANIFIE peut être démarré.")

    @action(detail=True, methods=['post'])
    def terminer(self, request, pk=None):
        return self._respond(pk, [Statut.EN_COURS], Statut.TERMINE,
                             "Seul un lot EN_COURS peut être terminé.",
                             emplacement_id=request.data.get('emplacement'))

    @action(detail=True, methods=['post'])
    def annuler(self, request, pk=None):
        return self._respond(pk, [Statut.PLANIFIE, Statut.EN_COURS], Statut.ANNULE,
                             "Seul un lot PLANIFIE ou EN_COURS peut être annulé.")