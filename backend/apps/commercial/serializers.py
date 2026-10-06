import uuid
from decimal import Decimal

from django.db import transaction
from rest_framework import serializers
from apps.clients.permissions import peut_voir
from apps.budget.models import EngagementBudget
from apps.clients.models import Client

from .models import (
    Commande, DevisProforma, LigneCommande, LigneDevis, LignePlanification,
    PlanificationBesoin,
)

SOA = (Client.TypeClient.MINISTERE, Client.TypeClient.CTD)


# ------------------------------------------------------------------- Utilitaires
def verifier_doublons(lignes):
    ids = [l['produit'].pk for l in lignes]
    if len(ids) != len(set(ids)):
        raise serializers.ValidationError("Un même produit ne peut apparaître qu'une fois.")
    return lignes


def remplacer_lignes(parent, modele, champ_parent, lignes):
    modele.objects.filter(**{champ_parent: parent}).delete()
    modele.objects.bulk_create([modele(**{champ_parent: parent}, **l) for l in lignes])


def provisoire(prefixe):
    return f'{prefixe}-TMP-{uuid.uuid4().hex[:20]}'


def total_lignes(lignes, champ_qte, champ_prix):
    return sum((getattr(l, champ_qte) * getattr(l, champ_prix) for l in lignes), Decimal('0'))

class ClientVisibleMixin:
    """Interdit d'utiliser un client d'un type que l'utilisateur n'a pas le droit de voir."""
    def validate_client(self, client):
        request = self.context.get('request')
        if request is not None and not peut_voir(request.user, client):
            raise serializers.ValidationError(
                "Votre rôle ne permet pas de travailler avec ce type de client."
            )
        return client
        
class LignesMixin:
    """Création / modification d'un document avec ses lignes, en une transaction."""
    lignes_model = None
    lignes_fk = None

    def preparer_lignes(self, validated, lignes):
        return lignes

    def creer_objet(self, validated):
        return self.Meta.model.objects.create(**validated)

    def create(self, validated):
        lignes = self.preparer_lignes(validated, validated.pop('lignes', None))
        with transaction.atomic():
            obj = self.creer_objet(validated)
            remplacer_lignes(obj, self.lignes_model, self.lignes_fk, lignes)
        return obj

    def update(self, instance, validated):
        lignes = validated.pop('lignes', None)
        with transaction.atomic():
            instance = super().update(instance, validated)
            if lignes is not None:
                lignes = self.preparer_lignes(validated, lignes)
                remplacer_lignes(instance, self.lignes_model, self.lignes_fk, lignes)
        return instance


class LigneBase(serializers.ModelSerializer):
    code_produit = serializers.CharField(source='produit.code_produit', read_only=True)
    designation = serializers.CharField(source='produit.designation', read_only=True)

# ------------------------------------------------------------------ Planification
class LignePlanificationSerializer(LigneBase):
    class Meta:
        model = LignePlanification
        fields = ['produit', 'code_produit', 'designation', 'quantite_estimee']


class PlanificationBesoinSerializer(ClientVisibleMixin, LignesMixin, serializers.ModelSerializer):
    nom_client = serializers.CharField(source='client.nom_client', read_only=True)
    lignes = LignePlanificationSerializer(many=True, allow_empty=False)
    lignes_model = LignePlanification
    lignes_fk = 'planification'

    class Meta:
        model = PlanificationBesoin
        fields = [
            'id_planification', 'date_planif', 'periode_cible',
            'client', 'nom_client', 'lignes',
        ]

    def validate_lignes(self, lignes):
        return verifier_doublons(lignes)


# ------------------------------------------------------------------------- Devis
class LigneDevisSerializer(LigneBase):
    class Meta:
        model = LigneDevis
        fields = ['produit', 'code_produit', 'designation', 'quantite', 'prix_unitaire_devis']
        extra_kwargs = {'prix_unitaire_devis': {'required': False}}


class DevisProformaSerializer(ClientVisibleMixin, LignesMixin, serializers.ModelSerializer):
    nom_client = serializers.CharField(source='client.nom_client', read_only=True)
    lignes = LigneDevisSerializer(many=True, allow_empty=False)
    total = serializers.SerializerMethodField()
    date_expiration = serializers.DateField(read_only=True)
    est_expire = serializers.BooleanField(read_only=True)
    id_commande = serializers.IntegerField(source='commande.pk', read_only=True, default=None)
    lignes_model = LigneDevis
    lignes_fk = 'devis'

    class Meta:
        model = DevisProforma
        fields = [
            'id_devis', 'num_devis', 'date_devis', 'validite_jours', 'date_expiration',
            'est_expire', 'client', 'nom_client', 'lignes', 'total', 'id_commande',
        ]
        read_only_fields = ['num_devis']

    def get_total(self, obj):
        return total_lignes(obj.lignes.all(), 'quantite', 'prix_unitaire_devis')

    def validate_lignes(self, lignes):
        return verifier_doublons(lignes)

    def validate(self, attrs):
        if self.instance is not None and hasattr(self.instance, 'commande'):
            raise serializers.ValidationError(
                "Ce devis a donné lieu à une commande : il n'est plus modifiable."
            )
        return attrs

    def preparer_lignes(self, validated, lignes):
        for l in lignes or []:
            l.setdefault('prix_unitaire_devis', l['produit'].prix_tarif)
        return lignes

    def creer_objet(self, validated):
        devis = DevisProforma.objects.create(num_devis=provisoire('DEV'), **validated)
        devis.num_devis = f'DEV-{devis.date_devis.year}-{devis.pk:05d}'
        devis.save(update_fields=['num_devis'])
        return devis


# ---------------------------------------------------------------------- Commande
class LigneCommandeSerializer(LigneBase):
    class Meta:
        model = LigneCommande
        fields = [
            'produit', 'code_produit', 'designation',
            'quantite_commandee', 'prix_unitaire_facture',
        ]
        extra_kwargs = {'prix_unitaire_facture': {'required': False}}


class CommandeSerializer(ClientVisibleMixin, LignesMixin, serializers.ModelSerializer):
    nom_client = serializers.CharField(source='client.nom_client', read_only=True)
    type_client = serializers.CharField(source='client.type_client', read_only=True)
    num_devis = serializers.CharField(source='devis.num_devis', read_only=True, default=None)
    num_engagement_cf = serializers.CharField(
        source='engagement.num_engagement_cf', read_only=True, default=None
    )
    lignes = LigneCommandeSerializer(many=True, required=False)
    total = serializers.SerializerMethodField()
    lignes_model = LigneCommande
    lignes_fk = 'commande'

    class Meta:
        model = Commande
        fields = [
            'id_commande', 'num_commande', 'date_commande', 'statut_commande',
            'client', 'nom_client', 'type_client',
            'devis', 'num_devis', 'engagement', 'num_engagement_cf',
            'lignes', 'total',
        ]
        read_only_fields = ['num_commande', 'statut_commande']

    def get_total(self, obj):
        return total_lignes(obj.lignes.all(), 'quantite_commandee', 'prix_unitaire_facture')

    def validate_lignes(self, lignes):
        return verifier_doublons(lignes)

    def validate(self, attrs):
        inst = self.instance
        if inst is not None:
            if inst.statut_commande != Commande.Statut.BROUILLON:
                raise serializers.ValidationError(
                    "Seule une commande au statut BROUILLON est modifiable."
                )
            for champ in ('client', 'devis'):
                if champ in attrs and attrs[champ] != getattr(inst, champ):
                    raise serializers.ValidationError({champ: "Non modifiable."})
            client = inst.client
            engagement = attrs.get('engagement', inst.engagement)
        else:
            client = attrs['client']
            devis = attrs.get('devis')
            engagement = attrs.get('engagement')
            if not attrs.get('lignes') and devis is None:
                raise serializers.ValidationError(
                    {'lignes': "Fournissez des lignes ou un devis source."}
                )
            if devis is not None:
                if devis.client_id != client.pk:
                    raise serializers.ValidationError(
                        {'devis': "Ce devis appartient à un autre client."}
                    )
                if devis.est_expire:
                    raise serializers.ValidationError(
                        {'devis': f"Devis expiré depuis le {devis.date_expiration}."}
                    )

        if engagement is not None:
            if client.type_client not in SOA:
                raise serializers.ValidationError(
                    {'engagement': "Un engagement n'est autorisé que pour un SOA (MINISTERE ou CTD)."}
                )
            if engagement.client_id != client.pk:
                raise serializers.ValidationError(
                    {'engagement': "Cet engagement appartient à un autre SOA."}
                )
            if engagement.statut_engagement != EngagementBudget.Statut.VISE:
                raise serializers.ValidationError(
                    {'engagement': "L'engagement doit être au statut VISE."}
                )
        return attrs

    def preparer_lignes(self, validated, lignes):
        devis = validated.get('devis')
        if not lignes and devis is not None:
            return [
                {
                    'produit': l.produit,
                    'quantite_commandee': l.quantite,
                    'prix_unitaire_facture': l.prix_unitaire_devis,
                }
                for l in devis.lignes.select_related('produit')
            ]
        for l in lignes or []:
            l.setdefault('prix_unitaire_facture', l['produit'].prix_tarif)
        return lignes

    def creer_objet(self, validated):
        cmd = Commande.objects.create(num_commande=provisoire('CMD'), **validated)
        cmd.num_commande = f'CMD-{cmd.date_commande.year}-{cmd.pk:05d}'
        cmd.save(update_fields=['num_commande'])
        return cmd