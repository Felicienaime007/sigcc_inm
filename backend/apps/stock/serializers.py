from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework import serializers

from apps.produits.models import ProduitFini

from . import services
from .models import Emplacement, LigneStock, MagasinDepot, MouvementStock, ReservationStock

T = MouvementStock.Type


class MagasinDepotSerializer(serializers.ModelSerializer):
    nb_emplacements = serializers.IntegerField(read_only=True)

    class Meta:
        model = MagasinDepot
        fields = ['id_magasin', 'nom_magasin', 'code_depot', 'nb_emplacements']


class EmplacementSerializer(serializers.ModelSerializer):
    nom_magasin = serializers.CharField(source='magasin.nom_magasin', read_only=True)
    code_depot = serializers.CharField(source='magasin.code_depot', read_only=True)
    

    class Meta:
        model = Emplacement
        fields = [
            'id_emplacement', 'code_allee', 'code_etagere',
            'magasin', 'nom_magasin', 'code_depot',
        ]


class LigneStockSerializer(serializers.ModelSerializer):
    code_produit = serializers.CharField(source='produit.code_produit', read_only=True)
    designation = serializers.CharField(source='produit.designation', read_only=True)
    code_depot = serializers.CharField(source='emplacement.magasin.code_depot', read_only=True)
    code_allee = serializers.CharField(source='emplacement.code_allee', read_only=True)
    code_etagere = serializers.CharField(source='emplacement.code_etagere', read_only=True)
    quantite_disponible = serializers.IntegerField(source='disponible', read_only=True)

    class Meta:
        model = LigneStock
        fields = [
            'id', 'emplacement', 'code_depot', 'code_allee', 'code_etagere',
            'produit', 'code_produit', 'designation',
            'quantite_physique', 'quantite_reservee', 'quantite_disponible',
        ]
        read_only_fields = fields


class TransfertSerializer(serializers.Serializer):
    produit = serializers.PrimaryKeyRelatedField(queryset=ProduitFini.objects.all())
    source = serializers.PrimaryKeyRelatedField(queryset=Emplacement.objects.all())
    destination = serializers.PrimaryKeyRelatedField(queryset=Emplacement.objects.all())
    quantite = serializers.IntegerField(min_value=1)
    motif = serializers.CharField(required=False, allow_blank=True, max_length=100)

    def validate(self, attrs):
        if attrs['source'] == attrs['destination']:
            raise serializers.ValidationError("Source et destination doivent être différentes.")
        return attrs


class ReservationStockSerializer(serializers.ModelSerializer):
    code_produit = serializers.CharField(source='produit.code_produit', read_only=True)
    designation = serializers.CharField(source='produit.designation', read_only=True)
    num_commande = serializers.CharField(
        source='preparation.commande.num_commande', read_only=True, default=None
    )

    class Meta:
        model = ReservationStock
        fields = [
            'id_reservation', 'quantite_bloquee', 'date_limite',
            'produit', 'code_produit', 'designation', 'preparation', 'num_commande',
        ]
        extra_kwargs = {'date_limite': {'required': False}}

    def validate_date_limite(self, value):
        if value <= timezone.now():
            raise serializers.ValidationError("La date limite doit être dans le futur.")
        return value

    def validate(self, attrs):
        prep, produit = attrs.get('preparation'), attrs['produit']
        if prep is not None:
            if prep.statut_prepa != 'EN_COURS':
                raise serializers.ValidationError(
                    {'preparation': "La préparation doit être EN_COURS."}
                )
            ligne = prep.lignes.filter(produit=produit).first()
            if ligne is None:
                raise serializers.ValidationError(
                    {'produit': "Ce produit n'est pas dans la préparation."}
                )
            deja = ReservationStock.objects.filter(
                preparation=prep, produit=produit
            ).aggregate(q=Sum('quantite_bloquee'))['q'] or 0
            if deja + attrs['quantite_bloquee'] > ligne.quantite_preparee:
                raise serializers.ValidationError({
                    'quantite_bloquee': f"Dépasse la quantité préparée "
                                        f"({ligne.quantite_preparee}, déjà réservé {deja})."
                })
        return attrs

    def create(self, validated):
        with transaction.atomic():
            return services.reserver(
                validated['produit'].pk, validated['quantite_bloquee'],
                validated.get('date_limite'), validated.get('preparation'),
            )


class MouvementStockSerializer(serializers.ModelSerializer):
    code_produit = serializers.CharField(source='produit.code_produit', read_only=True)
    designation = serializers.CharField(source='produit.designation', read_only=True)
    num_bl = serializers.CharField(source='livraison.num_bl', read_only=True, default=None)
    code_depot = serializers.CharField(
        source='emplacement.magasin.code_depot', read_only=True, default=None
    )
    libelle_emplacement = serializers.SerializerMethodField()
    def get_libelle_emplacement(self, obj):
        return str(obj.emplacement) if obj.emplacement_id else None
    MANUELS = (T.ENTREE_INITIAL, T.ENTREE_AJUSTEMENT, T.SORTIE_AJUSTEMENT)

    class Meta:
        model = MouvementStock
        fields = [
            'id_mouvement', 'type_mouvement', 'quantite_mouv', 'date_mouv',
            'produit', 'code_produit', 'designation',
            'emplacement', 'code_depot', 'libelle_emplacement', 'livraison', 'num_bl', 'reference',
        ]
        read_only_fields = ['date_mouv', 'livraison']
        extra_kwargs = {
            'emplacement': {'required': True, 'allow_null': False},
            'reference': {'required': True, 'allow_null': False, 'allow_blank': False},
        }

    def validate_type_mouvement(self, value):
        if value not in self.MANUELS:
            raise serializers.ValidationError(
                "Type non autorisé en saisie manuelle : "
                "ENTREE_INITIAL, ENTREE_AJUSTEMENT ou SORTIE_AJUSTEMENT. "
                "Les autres mouvements sont générés par le système."
            )
        return value

    def create(self, validated):
        type_, emp = validated['type_mouvement'], validated['emplacement']
        pid, qte, ref = validated['produit'].pk, validated['quantite_mouv'], validated['reference']
        with transaction.atomic():
            if type_.startswith('ENTREE'):
                return services.entree(pid, qte, emp, type_, reference=ref)
            return services.sortie(pid, qte, type_, emplacement=emp, reference=ref)