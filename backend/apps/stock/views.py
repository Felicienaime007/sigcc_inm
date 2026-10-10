from django.db import transaction
from django.db.models import Count, F, Q, Sum
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response

from apps.authentification.mixins import ParamFilterMixin, ProtectedDeleteMixin
from apps.authentification.permissions import HasPrivilege, crud_map

from . import services
from .models import (
    Emplacement, Inventaire, LigneInventaire, LigneStock, MagasinDepot,
    MouvementStock, ReservationStock,
)
from .serializers import (
    EmplacementSerializer, InventaireSerializer, LigneInventaireSerializer,
    LigneStockSerializer, MagasinDepotSerializer, MouvementStockSerializer,
    ReservationStockSerializer, TransfertSerializer,
)


class BaseViewSet(ParamFilterMixin, ProtectedDeleteMixin, viewsets.ModelViewSet):
    permission_classes = [HasPrivilege]
    filter_backends = [SearchFilter, OrderingFilter]


class MagasinDepotViewSet(BaseViewSet):
    queryset = MagasinDepot.objects.annotate(nb_emplacements=Count('emplacements'))
    serializer_class = MagasinDepotSerializer
    privilege_map = crud_map('magasin')
    search_fields = ['nom_magasin', 'code_depot']


class EmplacementViewSet(BaseViewSet):
    queryset = Emplacement.objects.select_related('magasin')
    serializer_class = EmplacementSerializer
    privilege_map = crud_map('emplacement')
    search_fields = ['code_allee', 'code_etagere', 'magasin__code_depot']
    query_filters = {'magasin': 'magasin_id'}


class LigneStockViewSet(
    ParamFilterMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Lecture seule : le stock ne bouge que par les mouvements."""
    queryset = LigneStock.objects.select_related('produit', 'emplacement__magasin')
    serializer_class = LigneStockSerializer
    permission_classes = [HasPrivilege]
    filter_backends = [SearchFilter, OrderingFilter]
    privilege_map = {
        'list': 'stock.view', 'retrieve': 'stock.view', 'resume': 'stock.view',
        'transferer': 'stock.transfer',
    }
    search_fields = ['produit__code_produit', 'produit__designation']
    query_filters = {
        'produit': 'produit_id', 'emplacement': 'emplacement_id',
        'magasin': 'emplacement__magasin_id', 'categorie': 'produit__categorie_id',
    }

    @action(detail=False, methods=['get'])
    def resume(self, request):
        """Stock cumulé par produit (tous emplacements confondus).

        `?alerte=true` ne garde que les produits sous leur seuil d'alerte.
        """
        qs = self.filter_queryset(self.get_queryset()).order_by('produit__code_produit')
        lignes = qs.values(
            'produit_id', 'produit__code_produit', 'produit__designation',
            'produit__seuil_alerte',
        ).annotate(physique=Sum('quantite_physique'), reservee=Sum('quantite_reservee'))
        resultat = []
        for l in lignes:
            disponible = l['physique'] - l['reservee']
            seuil = l['produit__seuil_alerte'] or 0
            en_alerte = disponible <= seuil
            if request.query_params.get('alerte') == 'true' and not en_alerte:
                continue
            resultat.append({
                'produit': l['produit_id'], 'code_produit': l['produit__code_produit'],
                'designation': l['produit__designation'],
                'quantite_physique': l['physique'], 'quantite_reservee': l['reservee'],
                'quantite_disponible': disponible,
                'seuil_alerte': seuil, 'en_alerte': en_alerte,
            })
        return Response(resultat)

    @action(detail=False, methods=['post'])
    def transferer(self, request):
        s = TransfertSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        with transaction.atomic():
            services.transferer(
                d['produit'].pk, d['source'], d['destination'], d['quantite'], d.get('motif')
            )
        return Response({'detail': 'Transfert effectué.'}, status=status.HTTP_201_CREATED)


class ReservationStockViewSet(
    ParamFilterMixin,
    mixins.CreateModelMixin, mixins.ListModelMixin,
    mixins.RetrieveModelMixin, mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Pas de modification : DELETE = libération de la réservation."""
    queryset = ReservationStock.objects.select_related('produit', 'preparation__commande')
    serializer_class = ReservationStockSerializer
    permission_classes = [HasPrivilege]
    filter_backends = [SearchFilter, OrderingFilter]
    privilege_map = {
        'list': 'reservation.view', 'retrieve': 'reservation.view',
        'create': 'reservation.create', 'destroy': 'reservation.delete',
        'liberer_expirees': 'reservation.delete',
    }
    search_fields = ['produit__code_produit', 'preparation__commande__num_commande']
    query_filters = {'produit': 'produit_id', 'preparation': 'preparation_id'}

    def perform_destroy(self, instance):
        with transaction.atomic():
            services.liberer(instance)

    @action(detail=False, methods=['post'], url_path='liberer-expirees')
    def liberer_expirees(self, request):
        n = 0
        for r in ReservationStock.objects.filter(date_limite__lt=timezone.now()):
            with transaction.atomic():
                services.liberer(r)
            n += 1
        return Response({'liberees': n})


class MouvementStockViewSet(
    ParamFilterMixin,
    mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Journal figé : pas de modification ni de suppression."""
    queryset = MouvementStock.objects.select_related(
        'produit', 'livraison', 'emplacement__magasin'
    )
    serializer_class = MouvementStockSerializer
    permission_classes = [HasPrivilege]
    filter_backends = [SearchFilter, OrderingFilter]
    privilege_map = {
        'list': 'mouvement.view', 'retrieve': 'mouvement.view', 'create': 'mouvement.create',
    }
    search_fields = ['reference', 'produit__code_produit', 'livraison__num_bl']
    query_filters = {
        'produit': 'produit_id', 'type': 'type_mouvement', 'emplacement': 'emplacement_id',
        'livraison': 'livraison_id', 'annee': 'date_mouv__year',
        'du': 'date_mouv__date__gte', 'au': 'date_mouv__date__lte',
    }


class InventaireViewSet(BaseViewSet):
    """Inventaire physique : BROUILLON → EN_COURS (démarrer) → VALIDE (valider)."""
    queryset = Inventaire.objects.select_related('magasin').annotate(
        nb_lignes=Count('lignes', distinct=True),
        nb_comptees=Count('lignes', filter=Q(lignes__quantite_comptee__isnull=False)),
    ).order_by('-date_debut', '-id_inventaire')   # l'agrégation neutralise l'ordering du Meta
    serializer_class = InventaireSerializer
    privilege_map = {
        **crud_map('inventaire'),
        'demarrer': 'inventaire.update', 'valider': 'inventaire.valider',
        'annuler': 'inventaire.update',
    }
    search_fields = ['code_inventaire', 'magasin__code_depot']
    query_filters = {'magasin': 'magasin_id', 'statut': 'statut'}

    def perform_update(self, serializer):
        if serializer.instance.statut not in (
            Inventaire.Statut.BROUILLON, Inventaire.Statut.EN_COURS
        ):
            raise ValidationError({'detail': "Cet inventaire est figé."})
        serializer.save()

    def perform_destroy(self, instance):
        if instance.statut != Inventaire.Statut.BROUILLON:
            raise ValidationError(
                {'detail': "Seul un inventaire BROUILLON est supprimable."}
            )
        instance.delete()

    @action(detail=True, methods=['post'])
    def demarrer(self, request, pk=None):
        self.get_object()
        services.demarrer_inventaire(self.get_object())
        return Response(self.get_serializer(self.get_object()).data)

    @action(detail=True, methods=['post'])
    def valider(self, request, pk=None):
        self.get_object()
        services.valider_inventaire(self.get_object())
        return Response(self.get_serializer(self.get_object()).data)

    @action(detail=True, methods=['post'])
    def annuler(self, request, pk=None):
        inv = self.get_object()
        with transaction.atomic():
            inv = Inventaire.objects.select_for_update().get(pk=inv.pk)
            if inv.statut not in (Inventaire.Statut.BROUILLON, Inventaire.Statut.EN_COURS):
                raise ValidationError({'detail': "Cet inventaire est déjà figé."})
            inv.statut = Inventaire.Statut.ANNULE
            inv.date_fin = timezone.now()
            inv.save(update_fields=['statut', 'date_fin'])
        return Response(self.get_serializer(self.get_object()).data)


class LigneInventaireViewSet(
    ParamFilterMixin,
    mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Saisie des comptages : seul quantite_comptee (+ motif) est modifiable."""
    queryset = LigneInventaire.objects.select_related(
        'produit', 'emplacement__magasin', 'inventaire'
    )
    serializer_class = LigneInventaireSerializer
    permission_classes = [HasPrivilege]
    filter_backends = [SearchFilter, OrderingFilter]
    privilege_map = {
        'list': 'inventaire.view', 'retrieve': 'inventaire.view',
        'update': 'inventaire.update', 'partial_update': 'inventaire.update',
    }
    search_fields = ['produit__code_produit', 'produit__designation']
    query_filters = {
        'inventaire': 'inventaire_id', 'produit': 'produit_id',
        'magasin': 'emplacement__magasin_id',
    }

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.query_params.get('ecart') == 'true':
            qs = qs.exclude(quantite_comptee__isnull=True).exclude(
                quantite_comptee=F('quantite_theorique')
            )
        return qs