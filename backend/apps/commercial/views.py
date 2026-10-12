from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response

from apps.authentification.mixins import ParamFilterMixin, ProtectedDeleteMixin
from apps.authentification.permissions import HasPrivilege, crud_map
from apps.budget.models import EngagementBudget
from apps.clients.models import Client
from .services import encours_client

from .models import Commande, DevisProforma, PlanificationBesoin
from .serializers import (
    SOA, CommandeSerializer, DevisProformaSerializer,
    PlanificationBesoinSerializer, total_lignes,
)


class BaseViewSet(ParamFilterMixin, ProtectedDeleteMixin, viewsets.ModelViewSet):
    permission_classes = [HasPrivilege]
    filter_backends = [SearchFilter, OrderingFilter]


class PlanificationBesoinViewSet(BaseViewSet):
    queryset = PlanificationBesoin.objects.select_related('client').prefetch_related(
        'lignes__produit'
    )
    serializer_class = PlanificationBesoinSerializer
    privilege_map = crud_map('planification')
    search_fields = ['client__nom_client', 'periode_cible']
    query_filters = {'client': 'client_id', 'periode': 'periode_cible'}


class DevisProformaViewSet(BaseViewSet):
    queryset = DevisProforma.objects.select_related('client', 'commande').prefetch_related(
        'lignes__produit'
    )
    serializer_class = DevisProformaSerializer
    privilege_map = crud_map('devis')
    search_fields = ['num_devis', 'client__nom_client']
    query_filters = {'client': 'client_id', 'annee': 'date_devis__year'}


class CommandeViewSet(BaseViewSet):
    queryset = Commande.objects.select_related(
        'client', 'devis', 'engagement'
    ).prefetch_related('lignes__produit')
    serializer_class = CommandeSerializer
    privilege_map = {
        **crud_map('commande'),
        'valider': 'commande.valider',
        'annuler': 'commande.update',
    }
    search_fields = ['num_commande', 'client__nom_client', 'client__code_soa']
    query_filters = {
        'client': 'client_id',
        'type_client': 'client__type_client',
        'statut': 'statut_commande',
        'devis': 'devis_id',
        'engagement': 'engagement_id',
        'annee': 'date_commande__year',
    }

    def get_queryset(self):
        qs = super().get_queryset()
        # ?statuts=VALIDEE,FACTUREE : commandes dans l'un des statuts listés
        # (file de facturation / préparation du privé).
        statuts = self.request.query_params.get('statuts')
        if statuts:
            qs = qs.filter(statut_commande__in=[
                s.strip() for s in statuts.split(',') if s.strip()
            ])
        return qs

    def destroy(self, request, *args, **kwargs):
        if self.get_object().statut_commande != Commande.Statut.BROUILLON:
            return Response(
                {'detail': "Seule une commande BROUILLON est supprimable : utilisez « annuler »."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)

    # ---------------------------------------------------------------- valider
    @action(detail=True, methods=['post'])
    def valider(self, request, pk=None):
        self.get_object()   # 404 si absent
        with transaction.atomic():
            cmd = Commande.objects.select_for_update().select_related('client').get(pk=pk)
            if cmd.statut_commande != Commande.Statut.BROUILLON:
                raise ValidationError({'detail': "Seule une commande BROUILLON peut être validée."})

            lignes = list(cmd.lignes.all())
            if not lignes:
                raise ValidationError({'detail': "La commande ne contient aucune ligne."})
            total = total_lignes(lignes, 'quantite_commandee', 'prix_unitaire_facture')
            client = cmd.client

            if client.type_client in SOA:
                if cmd.engagement_id is None:
                    raise ValidationError(
                        {'detail': "Un SOA doit rattacher un engagement visé à sa commande."}
                    )
                eng = EngagementBudget.objects.select_for_update().get(pk=cmd.engagement_id)
                if eng.statut_engagement != EngagementBudget.Statut.VISE:
                    raise ValidationError({'detail': "L'engagement n'est plus au statut VISE."})
                if total > eng.montant_engage:
                    raise ValidationError({
                        'detail': f"Total {total} Ar supérieur au montant engagé "
                                  f"({eng.montant_engage} Ar)."
                    })
                eng.statut_engagement = EngagementBudget.Statut.SOLDE
                eng.save(update_fields=['statut_engagement'])

            elif client.type_client == Client.TypeClient.PRIVE:
                solv = getattr(client, 'solvabilite', None)
                if solv is None:
                    raise ValidationError(
                        {'detail': "Aucune fiche de solvabilité pour ce client privé."}
                    )
                if solv.statut_blocage:
                    raise ValidationError({'detail': "Client bloqué : commande impossible."})
                from apps.recouvrement.services import client_en_contentieux
                if client_en_contentieux(client):
                    raise ValidationError(
                        {'detail': "Client en contentieux : commande impossible."}
                    )
                encours = encours_client(client)
                if total + encours > solv.plafond_encours:
                    raise ValidationError({
                        'detail': f"Total {total} Ar + encours {encours} Ar supérieur au "
                                  f"plafond d'encours ({solv.plafond_encours} Ar)."
                    })

            cmd.statut_commande = Commande.Statut.VALIDEE
            cmd.save(update_fields=['statut_commande'])
        return Response(self.get_serializer(self.get_object()).data)

    # ---------------------------------------------------------------- annuler
    @action(detail=True, methods=['post'])
    def annuler(self, request, pk=None):
        self.get_object()
        with transaction.atomic():
            cmd = Commande.objects.select_for_update().get(pk=pk)
            if cmd.statut_commande not in (Commande.Statut.BROUILLON, Commande.Statut.VALIDEE):
                raise ValidationError(
                    {'detail': "Seule une commande BROUILLON ou VALIDEE peut être annulée."}
                )
            if cmd.engagement_id is not None:
                eng = EngagementBudget.objects.select_for_update().get(pk=cmd.engagement_id)
                # Un engagement consommé par cette commande redevient disponible
                if cmd.statut_commande == Commande.Statut.VALIDEE:
                    eng.statut_engagement = EngagementBudget.Statut.VISE
                    eng.save(update_fields=['statut_engagement'])
                cmd.engagement = None   # libère le lien UNIQUE
            cmd.statut_commande = Commande.Statut.ANNULEE
            cmd.save(update_fields=['statut_commande', 'engagement'])
        return Response(self.get_serializer(self.get_object()).data)