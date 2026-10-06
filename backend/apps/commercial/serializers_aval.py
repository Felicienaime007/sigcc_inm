from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings
from django.db import transaction
from django.db.models import Sum
from rest_framework import serializers
from apps.clients.permissions import peut_voir
from apps.stock.services import disponible
from .models import (
    Avoir, BonLivraison, Commande, Facture, LigneAvoir, LigneFacture, LigneLivraison,
    LignePreparation, PreparationCommande,
)
from .serializers import (
    SOA, LigneBase, LignesMixin, provisoire, total_lignes, verifier_doublons,
)
from .services import apres_livraison, numero

CENTIMES = Decimal('0.01')


# ------------------------------------------------------------------ Préparation
class LignePreparationSerializer(LigneBase):
    class Meta:
        model = LignePreparation
        fields = ['produit', 'code_produit', 'designation', 'quantite_preparee']


class PreparationCommandeSerializer(LignesMixin, serializers.ModelSerializer):
    num_commande = serializers.CharField(source='commande.num_commande', read_only=True)
    nom_client = serializers.CharField(source='commande.client.nom_client', read_only=True)
    lignes = LignePreparationSerializer(many=True, required=False, allow_empty=False)
    id_livraison = serializers.IntegerField(source='bon_livraison.pk', read_only=True, default=None)
    lignes_model = LignePreparation
    lignes_fk = 'preparation'

    class Meta:
        model = PreparationCommande
        fields = [
            'id_preparation', 'date_prepa', 'statut_prepa',
            'commande', 'num_commande', 'nom_client', 'lignes', 'id_livraison',
        ]
        read_only_fields = ['date_prepa', 'statut_prepa']

    def validate_lignes(self, lignes):
        return verifier_doublons(lignes)

    def validate(self, attrs):
        inst = self.instance
        if inst is None:
            commande = attrs['commande']
            if commande.statut_commande != Commande.Statut.VALIDEE:
                raise serializers.ValidationError(
                    {'commande': "La commande doit être au statut VALIDEE."}
                )
        else:
            if inst.statut_prepa != PreparationCommande.Statut.EN_COURS:
                raise serializers.ValidationError(
                    "Seule une préparation EN_COURS est modifiable."
                )
            if 'commande' in attrs and attrs['commande'] != inst.commande:
                raise serializers.ValidationError({'commande': "Non modifiable."})
            commande = inst.commande

        lignes = attrs.get('lignes')
        if lignes:
            max_par_produit = {
                l.produit_id: l.quantite_commandee for l in commande.lignes.all()
            }
            for l in lignes:
                pid = l['produit'].pk
                if pid not in max_par_produit:
                    raise serializers.ValidationError(
                        {'lignes': f"Le produit {l['produit'].code_produit} n'est pas dans la commande."}
                    )
                if l['quantite_preparee'] > max_par_produit[pid]:
                    raise serializers.ValidationError({
                        'lignes': f"{l['produit'].code_produit} : quantité préparée supérieure "
                                  f"à la quantité commandée ({max_par_produit[pid]})."
                    })
        return attrs

    def preparer_lignes(self, validated, lignes):
        if lignes:
            return lignes
        # Création sans lignes : copie de la commande
        return [
            {'produit': l.produit, 'quantite_preparee': l.quantite_commandee}
            for l in validated['commande'].lignes.select_related('produit')
        ]

    def creer_objet(self, validated):
        cmd = Commande.objects.select_for_update().get(pk=validated['commande'].pk)
        if cmd.statut_commande != Commande.Statut.VALIDEE:
            raise serializers.ValidationError(
                {'commande': "La commande doit être au statut VALIDEE."}
            )
        cmd.statut_commande = Commande.Statut.EN_PREPARATION
        cmd.save(update_fields=['statut_commande'])
        return PreparationCommande.objects.create(**validated)


# ------------------------------------------------------------------- Livraison
class LigneLivraisonSerializer(LigneBase):
    class Meta:
        model = LigneLivraison
        fields = ['produit', 'code_produit', 'designation', 'quantite_livree']


class BonLivraisonSerializer(serializers.ModelSerializer):
    lignes = LigneLivraisonSerializer(many=True, read_only=True)
    num_commande = serializers.SerializerMethodField()
    nom_client = serializers.SerializerMethodField()

    class Meta:
        model = BonLivraison
        fields = [
            'id_livraison', 'num_bl', 'date_livraison', 'preparation', 'facture',
            'num_commande', 'nom_client', 'lignes',
        ]
        read_only_fields = ['num_bl', 'date_livraison']

    def get_num_commande(self, obj):
        return obj.preparation.commande.num_commande if obj.preparation_id else None

    def get_nom_client(self, obj):
        if obj.preparation_id:
            return obj.preparation.commande.client.nom_client
        return obj.facture.client_facture.nom_client

    def validate(self, attrs):
        prep, fac = attrs.get('preparation'), attrs.get('facture')
        if (prep is None) == (fac is None):
            raise serializers.ValidationError(
                "Fournissez soit 'preparation' (commande), soit 'facture' (vente comptoir)."
            )
        if prep is not None and prep.statut_prepa != PreparationCommande.Statut.PRETE:
            raise serializers.ValidationError(
                {'preparation': "La préparation doit être au statut PRETE."}
            )
        if fac is not None and fac.statut_paiement != Facture.StatutPaiement.PAYEE:
            raise serializers.ValidationError(
                {'facture': "La facture comptoir doit être PAYEE avant la livraison."}
            )
        return attrs

    def create(self, validated):
        with transaction.atomic():
            if validated.get('preparation') is not None:
                prep = PreparationCommande.objects.select_for_update().get(
                    pk=validated['preparation'].pk
                )
                if prep.statut_prepa != PreparationCommande.Statut.PRETE:
                    raise serializers.ValidationError(
                        {'preparation': "La préparation doit être au statut PRETE."}
                    )
                source = [(l.produit, l.quantite_preparee) for l in prep.lignes.all()]
                prep.statut_prepa = PreparationCommande.Statut.LIVREE
                prep.save(update_fields=['statut_prepa'])
                cmd = Commande.objects.select_for_update().get(pk=prep.commande_id)
                cmd.statut_commande = Commande.Statut.LIVREE
                cmd.save(update_fields=['statut_commande'])
                bl = BonLivraison.objects.create(num_bl=provisoire('BL'), preparation=prep)
            else:
                fac = Facture.objects.select_for_update().get(pk=validated['facture'].pk)
                source = [(l.produit, l.quantite_facturee) for l in fac.lignes.all()]
                bl = BonLivraison.objects.create(num_bl=provisoire('BL'), facture=fac)

            bl.num_bl = numero('BL', bl, bl.date_livraison)
            bl.save(update_fields=['num_bl'])
            LigneLivraison.objects.bulk_create([
                LigneLivraison(livraison=bl, produit=p, quantite_livree=q) for p, q in source
            ])
            apres_livraison(bl)
        return bl


# ---------------------------------------------------------------------- Facture
class LigneFactureSerializer(LigneBase):
    class Meta:
        model = LigneFacture
        fields = ['produit', 'code_produit', 'designation', 'quantite_facturee', 'prix_unitaire']
        extra_kwargs = {'prix_unitaire': {'required': False}}


class FactureSerializer(serializers.ModelSerializer):
    lignes = LigneFactureSerializer(many=True, required=False, allow_empty=False)
    num_commande = serializers.CharField(source='commande.num_commande', read_only=True, default=None)
    nom_client = serializers.SerializerMethodField()
    type_client = serializers.SerializerMethodField()
    montant_ttc = serializers.SerializerMethodField()
    id_livraison = serializers.IntegerField(source='bon_livraison.pk', read_only=True, default=None)
    total_regle = serializers.SerializerMethodField()
    reste_a_payer = serializers.SerializerMethodField()


    class Meta:
        model = Facture
        fields = [
            'id_facture', 'num_facture', 'date_facture', 'montant_ht', 'tva', 'montant_ttc',
            'type_facturation', 'statut_paiement',
            'commande', 'num_commande', 'client', 'nom_client', 'type_client',
            'id_livraison', 'lignes', 'total_regle', 'reste_a_payer',
        ]
        read_only_fields = [
            'num_facture', 'date_facture', 'montant_ht', 'tva',
            'type_facturation', 'statut_paiement',
        ]

    def get_nom_client(self, obj):
        return obj.client_facture.nom_client

    def get_type_client(self, obj):
        return obj.client_facture.type_client

    def get_montant_ttc(self, obj):
        return obj.montant_ttc
    
    def get_total_regle(self, obj):
        from apps.tresorerie.services import total_regle
        return total_regle(obj)

    def get_reste_a_payer(self, obj):
        from apps.tresorerie.services import reste_a_payer
        return reste_a_payer(obj)

    def validate_lignes(self, lignes):
        return verifier_doublons(lignes)

    def validate(self, attrs):
        commande, client = attrs.get('commande'), attrs.get('client')
        if (commande is None) == (client is None):
            raise serializers.ValidationError(
                "Fournissez soit 'commande', soit 'client' (vente comptoir), jamais les deux."
            )
        cible = commande.client if commande is not None else client
        request = self.context.get('request')
        if request is not None and not peut_voir(request.user, cible):
            raise serializers.ValidationError(
                "Votre rôle ne permet pas de facturer ce type de client."
            )
        if commande is not None:
            if commande.statut_commande != Commande.Statut.LIVREE:
                raise serializers.ValidationError(
                    {'commande': "La commande doit être LIVREE avant d'être facturée."}
                )
            if attrs.get('lignes'):
                raise serializers.ValidationError(
                    {'lignes': "Les lignes viennent du bon de livraison : ne pas les fournir."}
                )
        else:
            if client.type_client != client.TypeClient.SIMPLE:
                raise serializers.ValidationError(
                    {'client': "La vente comptoir est réservée aux clients de type SIMPLE."}
                )
            if not attrs.get('lignes'):
                raise serializers.ValidationError({'lignes': "Au moins une ligne est requise."})
        return attrs

    def create(self, validated):
        with transaction.atomic():
            commande = validated.get('commande')
            if commande is not None:
                cmd = Commande.objects.select_for_update().select_related('client').get(
                    pk=commande.pk
                )
                if cmd.statut_commande != Commande.Statut.LIVREE:
                    raise serializers.ValidationError(
                        {'commande': "La commande doit être LIVREE avant d'être facturée."}
                    )
                bl = cmd.preparation.bon_livraison
                prix = {l.produit_id: l.prix_unitaire_facture for l in cmd.lignes.all()}
                lignes = [
                    {
                        'produit': l.produit,
                        'quantite_facturee': l.quantite_livree,
                        'prix_unitaire': prix[l.produit_id],
                    }
                    for l in bl.lignes.select_related('produit')
                ]
                client_facture = cmd.client
                cmd.statut_commande = Commande.Statut.FACTUREE
                cmd.save(update_fields=['statut_commande'])
                lien = {'commande': cmd}
            else:
                lignes = validated['lignes']
                for l in lignes:
                    # Vente comptoir : le prix du catalogue est imposé
                    l['prix_unitaire'] = l['produit'].prix_tarif
                    dispo = disponible(l['produit'].pk)
                    if l['quantite_facturee'] > dispo:
                        raise serializers.ValidationError({
                            'lignes': f"{l['produit'].code_produit} : stock insuffisant "
                                      f"(disponible {dispo})."
                        })
                client_facture = validated['client']
                lien = {'client': client_facture}

            ht = sum((l['quantite_facturee'] * l['prix_unitaire'] for l in lignes), Decimal('0'))
            taux = getattr(settings, 'TVA_TAUX', Decimal('0.20'))
            tva = (ht * taux).quantize(CENTIMES, rounding=ROUND_HALF_UP)
            type_fact = (
                Facture.TypeFacturation.VIREMENT_TRESOR
                if client_facture.type_client in SOA
                else Facture.TypeFacturation.QUITTANCE
            )

            facture = Facture.objects.create(
                num_facture=provisoire('FAC'), montant_ht=ht, tva=tva,
                type_facturation=type_fact, **lien,
            )
            facture.num_facture = numero('FAC', facture, facture.date_facture)
            facture.save(update_fields=['num_facture'])
            LigneFacture.objects.bulk_create([
                LigneFacture(facture=facture, **l) for l in lignes
            ])
        return facture


# ------------------------------------------------------------------------ Avoir
class LigneAvoirSerializer(LigneBase):
    class Meta:
        model = LigneAvoir
        fields = ['produit', 'code_produit', 'designation', 'quantite_retournee', 'montant_avoir']
        extra_kwargs = {'montant_avoir': {'required': False}}


class AvoirSerializer(serializers.ModelSerializer):
    lignes = LigneAvoirSerializer(many=True, allow_empty=False)
    num_facture = serializers.CharField(source='facture.num_facture', read_only=True)
    total_avoir = serializers.SerializerMethodField()

    class Meta:
        model = Avoir
        fields = [
            'id_avoir', 'num_avoir', 'date_avoir', 'motif',
            'facture', 'num_facture', 'lignes', 'total_avoir',
        ]
        read_only_fields = ['num_avoir', 'date_avoir']

    def get_total_avoir(self, obj):
        return sum((l.montant_avoir for l in obj.lignes.all()), Decimal('0'))

    def validate_lignes(self, lignes):
        return verifier_doublons(lignes)

    def create(self, validated):
        lignes = validated.pop('lignes')
        with transaction.atomic():
            facture = Facture.objects.select_for_update().get(pk=validated['facture'].pk)
            facturees = {l.produit_id: l for l in facture.lignes.all()}
            deja = {
                r['produit']: r['q']
                for r in LigneAvoir.objects.filter(avoir__facture=facture)
                .values('produit').annotate(q=Sum('quantite_retournee'))
            }
            lignes_ok = []
            for l in lignes:
                pid, produit = l['produit'].pk, l['produit']
                if pid not in facturees:
                    raise serializers.ValidationError(
                        {'lignes': f"{produit.code_produit} n'est pas sur la facture."}
                    )
                ligne_fac = facturees[pid]
                restant = ligne_fac.quantite_facturee - deja.get(pid, 0)
                if l['quantite_retournee'] > restant:
                    raise serializers.ValidationError({
                        'lignes': f"{produit.code_produit} : maximum retournable {restant} "
                                  f"(facturé {ligne_fac.quantite_facturee}, déjà en avoir "
                                  f"{deja.get(pid, 0)})."
                    })
                plafond = l['quantite_retournee'] * ligne_fac.prix_unitaire
                montant = l.get('montant_avoir', plafond)
                if montant > plafond:
                    raise serializers.ValidationError({
                        'lignes': f"{produit.code_produit} : montant d'avoir supérieur à "
                                  f"{plafond} Ar (quantité × prix facturé)."
                    })
                lignes_ok.append({**l, 'montant_avoir': montant})

            avoir = Avoir.objects.create(num_avoir=provisoire('AV'), **validated)
            avoir.num_avoir = numero('AV', avoir, avoir.date_avoir)
            avoir.save(update_fields=['num_avoir'])
            LigneAvoir.objects.bulk_create([LigneAvoir(avoir=avoir, **l) for l in lignes_ok])
        return avoir