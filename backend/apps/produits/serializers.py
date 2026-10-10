from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from .models import CategorieProduit, ConfigSerieDocument, LotLancementSerie, ProduitFini


class CategorieProduitSerializer(serializers.ModelSerializer):
    nb_produits = serializers.IntegerField(read_only=True)

    class Meta:
        model = CategorieProduit
        fields = ['id_categorie', 'libelle_categorie', 'nb_produits']


class ConfigSerieSerializer(serializers.ModelSerializer):
    code_produit = serializers.CharField(source='produit.code_produit', read_only=True, default=None)
    nb_lots = serializers.IntegerField(read_only=True)

    class Meta:
        model = ConfigSerieDocument
        fields = ['id_config', 'dernier_numero_valide', 'prefixe_courant', 'code_produit', 'nb_lots']

    def validate_dernier_numero_valide(self, value):
        # Le compteur n'est fixé qu'à la création ; ensuite il n'évolue que par les lots
        if self.instance is not None and value != self.instance.dernier_numero_valide:
            raise serializers.ValidationError(
                "Non modifiable : le compteur n'évolue que par le lancement de lots."
            )
        return value

    def validate(self, attrs):
        prep, produit = attrs.get('preparation'), attrs.get('produit')
        if prep is not None:
            if prep.statut_prepa != 'EN_COURS':
                raise serializers.ValidationError(
                    {'preparation': "La préparation doit être EN_COURS."}
                )
            if not prep.lignes.filter(produit=produit).exists():
                raise serializers.ValidationError(
                    {'preparation': "Ce produit n'est pas dans la préparation."}
                )
        return attrs

class ProduitFiniSerializer(serializers.ModelSerializer):
    libelle_categorie = serializers.CharField(source='categorie.libelle_categorie', read_only=True)
    numerote_en_serie = serializers.SerializerMethodField()
    prefixe_courant = serializers.CharField(source='config.prefixe_courant', read_only=True, default=None)
    dernier_numero_valide = serializers.IntegerField(
        source='config.dernier_numero_valide', read_only=True, default=None
    )

    class Meta:
        model = ProduitFini
        fields = [
            'id_produit', 'code_produit', 'designation', 'prix_tarif',
            'seuil_alerte',
            'categorie', 'libelle_categorie',
            'config', 'numerote_en_serie', 'prefixe_courant', 'dernier_numero_valide',
        ]

    def get_numerote_en_serie(self, obj):
        return obj.config_id is not None

    def validate(self, attrs):
        inst = self.instance
        if (inst is not None and 'config' in attrs and attrs['config'] != inst.config
                and inst.lots.exists()):
            raise serializers.ValidationError({
                'config': "Non modifiable : des lots ont déjà été lancés pour ce produit."
            })
        return attrs

class LotLancementSerieSerializer(serializers.ModelSerializer):
    code_produit = serializers.CharField(source='produit.code_produit', read_only=True)
    designation = serializers.CharField(source='produit.designation', read_only=True)
    num_commande = serializers.CharField(
        source='preparation.commande.num_commande', read_only=True, default=None
    )

    class Meta:
        model = LotLancementSerie
        fields = [
            'id_lot', 'num_lot', 'prefixe_serie', 'num_debut', 'num_fin',
            'quantite_lancee', 'date_lancement', 'statut_prod',
            'config', 'produit', 'code_produit', 'designation', 'num_commande', 'preparation'
        ]
        # Tout est calculé par le serveur sauf produit et quantité
        read_only_fields = [
            'num_lot', 'prefixe_serie', 'num_debut', 'num_fin',
            'date_lancement', 'statut_prod', 'config',
        ]

    def validate_produit(self, produit):
        if produit.config_id is None:
            raise serializers.ValidationError(
                "Ce produit n'est pas numéroté en série (aucune configuration associée)."
            )
        return produit

    def create(self, validated_data):
        produit = validated_data['produit']
        quantite = validated_data['quantite_lancee']
        with transaction.atomic():
            config = ConfigSerieDocument.objects.select_for_update().get(pk=produit.config_id)
            debut = config.dernier_numero_valide + 1
            fin = debut + quantite - 1
            lot = LotLancementSerie.objects.create(
                num_lot=f'L{config.pk}-{debut:07d}',
                prefixe_serie=config.prefixe_courant,
                num_debut=debut,
                num_fin=fin,
                quantite_lancee=quantite,
                date_lancement=timezone.now(),
                statut_prod=LotLancementSerie.Statut.PLANIFIE,
                config=config,
                produit=produit,
            )
            config.dernier_numero_valide = fin
            config.save(update_fields=['dernier_numero_valide'])
        return lot