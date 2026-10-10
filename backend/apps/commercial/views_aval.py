from django.db import transaction
from django.db.models import Q
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response
from apps.stock import services as stock_services
from apps.authentification.mixins import ParamFilterMixin
from apps.authentification.permissions import HasPrivilege, crud_map
from apps.produits.models import LotLancementSerie
from apps.clients.permissions import types_visibles

from .models import Avoir, BonLivraison, Commande, Facture, PreparationCommande
from .serializers_aval import (
    AvoirSerializer, BonLivraisonSerializer, FactureSerializer,
    PreparationCommandeSerializer,
)
from .views import BaseViewSet

Prep = PreparationCommande.Statut

def visibles(qs, user, *chemins_client):
    """Ne garde que les documents dont le client est d'un type visible par l'utilisateur."""
    q = Q()
    for chemin in chemins_client:
        q |= Q(**{f'{chemin}__type_client__in': types_visibles(user)})
    return qs.filter(q)
class LectureCreationViewSet(
    ParamFilterMixin,
    mixins.CreateModelMixin, mixins.ListModelMixin,
    mixins.RetrieveModelMixin, viewsets.GenericViewSet,
):
    """Documents figés : pas de modification ni de suppression."""
    permission_classes = [HasPrivilege]
    filter_backends = [SearchFilter, OrderingFilter]


class PreparationCommandeViewSet(BaseViewSet):
    queryset = PreparationCommande.objects.select_related(
        'commande__client', 'bon_livraison'
    ).prefetch_related('lignes__produit')
    serializer_class = PreparationCommandeSerializer
    privilege_map = {
        **crud_map('preparation'),
        'terminer': 'preparation.update',
        'reserver': 'preparation.update',
    }
    search_fields = ['commande__num_commande', 'commande__client__nom_client']
    query_filters = {
        'commande': 'commande_id', 'statut': 'statut_prepa',
        'client': 'commande__client_id',
    }

    def perform_destroy(self, instance):
        if instance.statut_prepa == Prep.LIVREE:
            raise ValidationError({'detail': "Une préparation LIVREE n'est plus supprimable."})
        with transaction.atomic():
            cmd = Commande.objects.select_for_update().get(pk=instance.commande_id)
            stock_services.liberer_preparation(instance)
            instance.delete()   # ProtectedError (-> 409) si des lots y sont liés : tout est annulé
            cmd.statut_commande = Commande.Statut.VALIDEE
            cmd.save(update_fields=['statut_commande'])

    @action(detail=True, methods=['post'])
    def terminer(self, request, pk=None):
        self.get_object()
        with transaction.atomic():
            prep = PreparationCommande.objects.select_for_update().get(pk=pk)
            if prep.statut_prepa != Prep.EN_COURS:
                raise ValidationError({'detail': "Seule une préparation EN_COURS peut être terminée."})
            ouverts = prep.lots.exclude(
                statut_prod__in=[LotLancementSerie.Statut.TERMINE, LotLancementSerie.Statut.ANNULE]
            ).count()
            if ouverts:
                raise ValidationError({
                    'detail': f"{ouverts} lot(s) de production lié(s) ne sont pas terminés."
                })
            manques = stock_services.manques_reservation(prep)
            if manques:
                raise ValidationError({
                    'detail': "Stock non réservé pour : " + ", ".join(manques)
                              + ". Utilisez « reserver » d'abord."
                })
            prep.statut_prepa = Prep.PRETE
            prep.save(update_fields=['statut_prepa'])
        return Response(self.get_serializer(self.get_object()).data)

    @action(detail=True, methods=['post'])
    def reserver(self, request, pk=None):
        """Réserve le stock de toutes les lignes (tout ou rien). Idempotent."""
        self.get_object()
        with transaction.atomic():
            prep = PreparationCommande.objects.select_for_update().get(pk=pk)
            if prep.statut_prepa != Prep.EN_COURS:
                raise ValidationError({'detail': "La préparation doit être EN_COURS."})
            stock_services.reserver_preparation(prep)
        return Response(self.get_serializer(self.get_object()).data)


class BonLivraisonViewSet(LectureCreationViewSet):
    queryset = BonLivraison.objects.select_related(
        'preparation__commande__client', 'facture__client'
    ).prefetch_related('lignes__produit')
    serializer_class = BonLivraisonSerializer
    privilege_map = {'list': 'livraison.view', 'retrieve': 'livraison.view', 'create': 'livraison.create'}
    search_fields = ['num_bl', 'preparation__commande__num_commande', 'facture__num_facture']
    query_filters = {
        'preparation': 'preparation_id', 'facture': 'facture_id',
        'commande': 'preparation__commande_id', 'annee': 'date_livraison__year',
    }
    def get_queryset(self):
        return visibles(
            super().get_queryset(), self.request.user,
            'preparation__commande__client', 'facture__client',
        )

class FactureViewSet(LectureCreationViewSet):
    queryset = Facture.objects.select_related(
        'commande__client', 'client', 'bon_livraison'
    ).prefetch_related('lignes__produit')
    serializer_class = FactureSerializer
    privilege_map = {
        'list': 'facture.view', 'retrieve': 'facture.view', 'create': 'facture.create',
        'annuler': 'facture.annuler',
    }
    search_fields = [
        'num_facture', 'commande__num_commande',
        'commande__client__nom_client', 'client__nom_client',
    ]
    query_filters = {
        'commande': 'commande_id', 'type_facturation': 'type_facturation',
        'statut': 'statut_paiement', 'annee': 'date_facture__year',
    }

    def get_queryset(self):
        qs = visibles(super().get_queryset(), self.request.user, 'commande__client', 'client')
        params = self.request.query_params
        client = params.get('client')
        if client:
            qs = qs.filter(Q(client_id=client) | Q(commande__client_id=client))
        comptoir = params.get('comptoir')
        if comptoir in ('true', 'false'):
            qs = qs.filter(commande__isnull=(comptoir == 'true'))
        # Ventes comptoir payées, pas encore livrées (file du magasinier)
        if params.get('a_livrer') == 'true':
            qs = qs.filter(
                commande__isnull=True,
                statut_paiement=Facture.StatutPaiement.PAYEE,
                bon_livraison__isnull=True,
            )
        # Factures à encaisser : non payées ou partiellement payées
        if params.get('ouvertes') == 'true':
            qs = qs.filter(statut_paiement__in=[
                Facture.StatutPaiement.NON_PAYEE, Facture.StatutPaiement.PARTIELLE,
            ])
        return qs

    @action(detail=True, methods=['post'])
    def annuler(self, request, pk=None):
        """Annule une facture non payée : body {"motif": "..."}.

        Refusée si un encaissement ACTIF, un avoir ou un bon de livraison existe.
        La commande FACTUREE repasse à LIVREE.
        """
        from django.utils import timezone
        from apps.tresorerie.models import Reglement
        self.get_object()
        motif = (request.data.get('motif') or '').strip()
        if not motif:
            raise ValidationError({'motif': "Le motif d'annulation est obligatoire."})
        with transaction.atomic():
            facture = Facture.objects.select_for_update().get(pk=pk)
            if facture.statut_paiement == Facture.StatutPaiement.ANNULEE:
                raise ValidationError({'detail': "Cette facture est déjà annulée."})
            if facture.statut_paiement != Facture.StatutPaiement.NON_PAYEE:
                raise ValidationError(
                    {'detail': "Seule une facture non payée peut être annulée."}
                )
            if Reglement.objects.filter(
                facture=facture, statut=Reglement.Statut.ACTIF
            ).exists():
                raise ValidationError(
                    {'detail': "Des règlements existent : contre-passez-les d'abord."}
                )
            if facture.avoirs.exists():
                raise ValidationError(
                    {'detail': "Des avoirs existent sur cette facture : annulation refusée."}
                )
            if hasattr(facture, 'bon_livraison') and facture.bon_livraison is not None:
                raise ValidationError(
                    {'detail': "Un bon de livraison existe : annulation refusée."}
                )
            if facture.commande_id is not None:
                cmd = Commande.objects.select_for_update().get(pk=facture.commande_id)
                if cmd.statut_commande == Commande.Statut.FACTUREE:
                    cmd.statut_commande = Commande.Statut.LIVREE
                    cmd.save(update_fields=['statut_commande'])
            facture.statut_paiement = Facture.StatutPaiement.ANNULEE
            facture.motif_annulation = motif
            facture.date_annulation = timezone.now()
            facture.save(update_fields=['statut_paiement', 'motif_annulation', 'date_annulation'])
        return Response(self.get_serializer(self.get_object()).data)


class AvoirViewSet(LectureCreationViewSet):
    queryset = Avoir.objects.select_related('facture').prefetch_related('lignes__produit')
    serializer_class = AvoirSerializer
    privilege_map = {
        'list': 'avoir.view', 'retrieve': 'avoir.view', 'create': 'avoir.create',
        'retour_stock': 'mouvement.create', 'rembourser': 'avoir.rembourser',
    }
    search_fields = ['num_avoir', 'facture__num_facture', 'motif']
    query_filters = {
        'facture': 'facture_id', 'annee': 'date_avoir__year',
        'statut': 'statut_remboursement',
    }
    
    def get_queryset(self):
        return visibles(
            super().get_queryset(), self.request.user,
            'facture__commande__client', 'facture__client',
        )

    @action(detail=True, methods=['post'], url_path='retour-stock')
    def retour_stock(self, request, pk=None):
        """Remet en stock les quantités de l'avoir : body {"emplacement": id}."""
        from apps.stock.models import Emplacement
        avoir = self.get_object()
        try:
            emp = Emplacement.objects.filter(pk=int(request.data.get('emplacement'))).first()
        except (TypeError, ValueError):
            emp = None
        if emp is None:
            raise ValidationError({'emplacement': "Emplacement obligatoire et valide."})
        with transaction.atomic():
            stock_services.retour_avoir(avoir, emp)
        return Response({'detail': 'Retour en stock enregistré.'})

    @action(detail=True, methods=['post'])
    def rembourser(self, request, pk=None):
        """Rembourse un avoir au client : body {"caisse": id}.

        Crée une SORTIE de caisse du montant TTC de l'avoir. Une seule fois.
        """
        from decimal import Decimal
        from django.conf import settings
        from django.utils import timezone
        from apps.tresorerie.models import Caisse, LivreCaisse
        from apps.tresorerie.services import journee_cloturee
        self.get_object()
        try:
            caisse_id = int(request.data.get('caisse'))
        except (TypeError, ValueError):
            caisse_id = None
        if caisse_id is None:
            raise ValidationError({'caisse': "Caisse obligatoire et valide."})
        with transaction.atomic():
            avoir = Avoir.objects.select_for_update().get(pk=pk)
            if avoir.statut_remboursement == Avoir.StatutRemboursement.REMBOURSE:
                raise ValidationError({'detail': "Cet avoir est déjà remboursé."})
            taux = getattr(settings, 'TVA_TAUX', Decimal('0.20'))
            ht = sum((l.montant_avoir for l in avoir.lignes.all()), Decimal('0'))
            montant = (ht * (1 + taux)).quantize(Decimal('0.01'))
            caisse = Caisse.objects.select_for_update().get(pk=caisse_id)
            if journee_cloturee(caisse, timezone.now()):
                raise ValidationError(
                    {'caisse': "Journée arrêtée pour cette caisse : remboursement refusé."}
                )
            if montant > caisse.solde_actuel:
                raise ValidationError(
                    {'caisse': f"Solde insuffisant ({caisse.solde_actuel} Ar)."}
                )
            caisse.solde_actuel -= montant
            caisse.save(update_fields=['solde_actuel'])
            LivreCaisse.objects.create(
                type_operation=LivreCaisse.Type.SORTIE, montant_op=montant,
                caisse=caisse,
                reference=f"REMBOURSEMENT {avoir.num_avoir}",
            )
            avoir.statut_remboursement = Avoir.StatutRemboursement.REMBOURSE
            avoir.date_remboursement = timezone.now()
            avoir.save(update_fields=['statut_remboursement', 'date_remboursement'])
        return Response(self.get_serializer(self.get_object()).data)