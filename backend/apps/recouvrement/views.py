from django.db import transaction
from django.utils import timezone
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response
from rest_framework import mixins, status, viewsets
from apps.authentification.mixins import ParamFilterMixin
from apps.commercial.models import Facture

from apps.authentification.permissions import HasPrivilege

from . import services
from .models import Recouvrement, Relance
from .serializers import RecouvrementSerializer, RelanceSerializer

Statut = Recouvrement.Statut


class RecouvrementViewSet(
    ParamFilterMixin,
    mixins.CreateModelMixin, mixins.ListModelMixin,
    mixins.RetrieveModelMixin, mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Un dossier évolue par ses actions (relancer, escalader, actualiser), pas par PUT/PATCH."""
    queryset = Recouvrement.objects.prefetch_related(
        'lignes__facture__commande__client', 'relances__auteur'
    )
    serializer_class = RecouvrementSerializer
    permission_classes = [HasPrivilege]
    filter_backends = [SearchFilter, OrderingFilter]
    privilege_map = {
        'list': 'recouvrement.view', 'retrieve': 'recouvrement.view',
        'impayes': 'recouvrement.view', 'relances': 'recouvrement.view',
        'create': 'recouvrement.create', 'destroy': 'recouvrement.delete',
        'relancer': 'recouvrement.update', 'escalader': 'recouvrement.update',
        'actualiser': 'recouvrement.update',
    }
    search_fields = [
        'num_dossier', 'lignes__facture__num_facture',
        'lignes__facture__commande__client__nom_client',
    ]
    query_filters = {
        'statut': 'statut_dossier', 'niveau': 'niveau_relance',
        'client': 'lignes__facture__commande__client_id',
        'facture': 'lignes__facture_id',
        'du': 'date_relance__gte', 'au': 'date_relance__lte',
    }

    def get_queryset(self):
        return super().get_queryset().distinct()   # les filtres passent par les lignes

    def perform_destroy(self, instance):
        if instance.niveau_relance != 1 or instance.statut_dossier != Statut.EN_COURS:
            raise ValidationError({
                'detail': "Seul un dossier EN_COURS au niveau 1 est supprimable."
            })
        instance.delete()   # les lignes partent en cascade

    # ----------------------------------------------------------------- actions
    def _tracer(self, dossier, nature, request):
        """Enregistre la relance effectuée : canal + commentaire + auteur."""
        canal = (request.data.get('canal') or Relance.Canal.TELEPHONE).strip().upper()
        if canal not in Relance.Canal.values:
            raise ValidationError(
                {'canal': f"Canal invalide. Choix : {', '.join(Relance.Canal.values)}."}
            )
        commentaire = (request.data.get('commentaire') or '').strip()
        auteur = request.user if getattr(request.user, 'pk', None) else None
        Relance.objects.create(
            dossier=dossier, niveau=dossier.niveau_relance, nature=nature,
            canal=canal, commentaire=commentaire, auteur=auteur,
        )

    def _agir(self, pk, fonction):
        self.get_object()   # 404 si absent
        with transaction.atomic():
            dossier = Recouvrement.objects.select_for_update().get(pk=pk)
            services.actualiser(dossier)    # on travaille sur des soldes à jour
            if dossier.statut_dossier == Statut.REGLE:
                # On retourne (sans lever) : la mise à jour du statut doit être enregistrée
                return Response(
                    {'detail': "Ce dossier est soldé (REGLE)."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            fonction(dossier)
        return Response(self.get_serializer(self.get_object()).data)

    @action(detail=True, methods=['post'])
    def relancer(self, request, pk=None):
        """Nouvelle relance au même niveau : body {canal?, commentaire?}."""
        def f(d):
            d.date_relance = timezone.localdate()
            d.save(update_fields=['date_relance'])
            self._tracer(d, Relance.Nature.RELANCE, request)
        return self._agir(pk, f)

    @action(detail=True, methods=['post'])
    def escalader(self, request, pk=None):
        """Passe au palier suivant ; le niveau 3 met le dossier en CONTENTIEUX.

        Body {canal?, commentaire?}. Le passage en CONTENTIEUX bloque
        automatiquement le client (voir services.bloquer_client).
        """
        def f(d):
            if d.niveau_relance >= 3:
                raise ValidationError({'detail': "Niveau maximum (3 - contentieux) déjà atteint."})
            d.niveau_relance += 1
            d.date_relance = timezone.localdate()
            if d.niveau_relance == 3:
                d.statut_dossier = Statut.CONTENTIEUX
            d.save(update_fields=['niveau_relance', 'date_relance', 'statut_dossier'])
            self._tracer(d, Relance.Nature.ESCALADE, request)
            if d.niveau_relance == 3:
                services.bloquer_client(d)
        return self._agir(pk, f)

    @action(detail=True, methods=['get'])
    def relances(self, request, pk=None):
        """Historique des relances du dossier : qui, quand, niveau, canal, commentaire."""
        dossier = self.get_object()
        return Response(RelanceSerializer(dossier.relances.all(), many=True).data)

    @action(detail=True, methods=['post'])
    def actualiser(self, request, pk=None):
        """Recalcule les soldes (après un avoir, par exemple). Peut solder le dossier."""
        self.get_object()
        with transaction.atomic():
            dossier = Recouvrement.objects.select_for_update().get(pk=pk)
            services.actualiser(dossier)
        return Response(self.get_serializer(self.get_object()).data)

    @action(detail=False, methods=['get'])
    def impayes(self, request):
        """
        Factures PRIVE impayées hors dossier actif.
        Par défaut seulement les échues ; ?tous=true inclut les non échues ; ?client=<id>.
        """
        qs = Facture.objects.filter(
            commande__client__type_client='PRIVE',
            statut_paiement__in=[
                Facture.StatutPaiement.NON_PAYEE, Facture.StatutPaiement.PARTIELLE,
            ],
        ).exclude(
            lignes_recouvrement__recouvrement__statut_dossier__in=services.ACTIFS
        ).select_related('commande__client').order_by('date_facture')

        client = request.query_params.get('client')
        if client:
            qs = qs.filter(commande__client_id=client)
        tous = request.query_params.get('tous') == 'true'

        resultat = []
        for f in qs:
            du = services.montant_du(f)
            retard = services.jours_retard(f)
            if du <= 0 or (retard == 0 and not tous):
                continue
            resultat.append({
                'facture': f.pk, 'num_facture': f.num_facture,
                'client': f.commande.client_id, 'nom_client': f.commande.client.nom_client,
                'date_facture': f.date_facture, 'echeance': services.echeance(f),
                'jours_retard': retard, 'montant_du': du,
                'statut_paiement': f.statut_paiement,
            })
        return Response(resultat)