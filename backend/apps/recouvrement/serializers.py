from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from apps.commercial.models import Facture
from apps.commercial.serializers import provisoire

from . import services
from .models import LigneRecouvrement, Recouvrement


class LigneRecouvrementSerializer(serializers.ModelSerializer):
    num_facture = serializers.CharField(source='facture.num_facture', read_only=True)
    date_facture = serializers.DateTimeField(source='facture.date_facture', read_only=True)
    echeance = serializers.SerializerMethodField()
    jours_retard = serializers.SerializerMethodField()

    class Meta:
        model = LigneRecouvrement
        fields = [
            'facture', 'num_facture', 'date_facture', 'echeance',
            'jours_retard', 'montant_a_recouvrer',
        ]

    def get_echeance(self, obj):
        return services.echeance(obj.facture)

    def get_jours_retard(self, obj):
        return services.jours_retard(obj.facture)


class RecouvrementSerializer(serializers.ModelSerializer):
    lignes = LigneRecouvrementSerializer(many=True, read_only=True)
    factures = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Facture.objects.all(), write_only=True
    )
    client = serializers.SerializerMethodField()
    nom_client = serializers.SerializerMethodField()
    total_a_recouvrer = serializers.SerializerMethodField()

    class Meta:
        model = Recouvrement
        fields = [
            'id_recouvrement', 'num_dossier', 'date_relance', 'niveau_relance',
            'statut_dossier', 'client', 'nom_client', 'total_a_recouvrer',
            'lignes', 'factures',
        ]
        read_only_fields = ['num_dossier', 'date_relance', 'niveau_relance', 'statut_dossier']

    # Le client est déduit de la première facture du dossier
    def _client(self, obj):
        ligne = next(iter(obj.lignes.all()), None)
        return ligne.facture.client_facture if ligne else None

    def get_client(self, obj):
        c = self._client(obj)
        return c.pk if c else None

    def get_nom_client(self, obj):
        c = self._client(obj)
        return c.nom_client if c else None

    def get_total_a_recouvrer(self, obj):
        return sum((l.montant_a_recouvrer for l in obj.lignes.all()), 0)

    def validate_factures(self, factures):
        if not factures:
            raise serializers.ValidationError("Au moins une facture est requise.")
        if len({f.pk for f in factures}) != len(factures):
            raise serializers.ValidationError("Une facture ne peut apparaître qu'une fois.")
        return factures

    def create(self, validated):
        ids = [f.pk for f in validated['factures']]
        with transaction.atomic():
            # Verrou : empêche deux dossiers simultanés sur la même facture
            factures = list(
                Facture.objects.select_for_update()
                .select_related('commande__client', 'client').filter(pk__in=ids)
            )
            erreurs = [e for f in factures for e in services.erreurs_facture(f)]
            if erreurs:
                raise serializers.ValidationError({'factures': erreurs})
            if len({f.client_facture.pk for f in factures}) > 1:
                raise serializers.ValidationError(
                    {'factures': ["Toutes les factures d'un dossier doivent être du même client."]}
                )

            dossier = Recouvrement.objects.create(num_dossier=provisoire('REC'))
            dossier.num_dossier = f'REC-{timezone.localdate().year}-{dossier.pk:05d}'
            dossier.save(update_fields=['num_dossier'])
            LigneRecouvrement.objects.bulk_create([
                LigneRecouvrement(
                    recouvrement=dossier, facture=f,
                    montant_a_recouvrer=services.montant_du(f),
                )
                for f in factures
            ])
        return dossier