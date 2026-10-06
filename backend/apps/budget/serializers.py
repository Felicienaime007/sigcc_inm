from django.db import transaction
from rest_framework import serializers
from decimal import Decimal 
from apps.clients.models import Client

from .models import (
    Budget, EngagementBudget, LigneBudgetaire, PrevisionBudgetaire, TypeFinancement,
)


class TypeFinancementSerializer(serializers.ModelSerializer):
    class Meta:
        model = TypeFinancement
        fields = ['id_type_financement', 'libelle_financement']


class BudgetSerializer(serializers.ModelSerializer):
    nom_organisme = serializers.CharField(source='organisme.nom_organisme', read_only=True)
    nb_lignes = serializers.IntegerField(read_only=True)
    total_disponible = serializers.DecimalField(
        max_digits=17, decimal_places=2, read_only=True
    )

    class Meta:
        model = Budget
        fields = [
            'id_budget', 'annee_budgetaire', 'montant_alloue',
            'organisme', 'nom_organisme', 'nb_lignes', 'total_disponible',
        ]
    def validate(self, attrs):
        inst = self.instance
        # L'organisme porte les SOA des engagements : il ne change plus dès qu'il y a des lignes
        if (inst is not None and 'organisme' in attrs and attrs['organisme'] != inst.organisme
                and inst.lignes.exists()):
            raise serializers.ValidationError(
                {'organisme': "Non modifiable : ce budget a des lignes budgétaires."}
            )
        return attrs

class LigneBudgetaireSerializer(serializers.ModelSerializer):
    annee_budgetaire = serializers.IntegerField(source='budget.annee_budgetaire', read_only=True)
    nom_organisme = serializers.CharField(
        source='budget.organisme.nom_organisme', read_only=True
    )
    libelle_financement = serializers.CharField(
        source='type_financement.libelle_financement', read_only=True, default=None
    )    
    nb_engagements = serializers.IntegerField(read_only=True)
    total_engage = serializers.DecimalField(max_digits=17, decimal_places=2, read_only=True)

    class Meta:
        model = LigneBudgetaire
        fields = [
            'id_ligne_budget', 'code_article', 'libelle_ligne', 'montant_disponible',
            'budget', 'annee_budgetaire', 'nom_organisme',
            'type_financement', 'libelle_financement',
            'nb_engagements', 'total_engage'
        ]
    def validate(self, attrs):
        inst = self.instance
        if inst is not None and inst.engagements.exists():
            # Le solde évolue uniquement par les engagements et leurs annulations
            if 'montant_disponible' in attrs and attrs['montant_disponible'] != inst.montant_disponible:
                raise serializers.ValidationError({
                    'montant_disponible': "Non modifiable : des engagements existent sur cette ligne."
                })
            if 'budget' in attrs and attrs['budget'] != inst.budget:
                raise serializers.ValidationError(
                    {'budget': "Non modifiable : des engagements existent sur cette ligne."}
                )
        return attrs

class PrevisionBudgetaireSerializer(serializers.ModelSerializer):
    code_article = serializers.CharField(source='ligne_budget.code_article', read_only=True)

    class Meta:
        model = PrevisionBudgetaire
        fields = ['id_prevision', 'montant_estime', 'periode', 'ligne_budget', 'code_article']


class EngagementBudgetSerializer(serializers.ModelSerializer):
    nom_client = serializers.CharField(source='client.nom_client', read_only=True)
    code_soa = serializers.CharField(source='client.code_soa', read_only=True)
    code_article = serializers.CharField(source='ligne_budget.code_article', read_only=True)
    annee_budgetaire = serializers.IntegerField(
        source='ligne_budget.budget.annee_budgetaire', read_only=True
    )
    nom_organisme = serializers.CharField(
        source='ligne_budget.budget.organisme.nom_organisme', read_only=True
    )
    id_commande = serializers.IntegerField(source='commande.pk', read_only=True, default=None)

    class Meta:
        model = EngagementBudget
        fields = [
            'id_engagement', 'num_engagement_cf', 'montant_engage', 'date_visa_cf',
            'statut_engagement', 'ligne_budget', 'code_article', 'annee_budgetaire',
            'nom_organisme', 'client', 'nom_client', 'code_soa', 'id_commande',
        ]
        # Le statut ne change que par les actions dédiées (annuler, ...)
        read_only_fields = ['statut_engagement']

    IMMUABLES = ('ligne_budget', 'client', 'montant_engage')

    def validate(self, attrs):
        if self.instance is not None:
            for champ in self.IMMUABLES:
                if champ in attrs and attrs[champ] != getattr(self.instance, champ):
                    raise serializers.ValidationError({
                        champ: "Non modifiable : annulez l'engagement puis recréez-le."
                    })
            return attrs

        client = attrs['client']
        ligne = attrs['ligne_budget']
        if client.type_client not in (Client.TypeClient.MINISTERE, Client.TypeClient.CTD):
            raise serializers.ValidationError({
                'client': "Seul un SOA (type MINISTERE ou CTD) peut avoir un engagement budgétaire."
            })
        if client.organisme_id != ligne.budget.organisme_id:
            raise serializers.ValidationError({
                'ligne_budget': "Cette ligne appartient au budget d'un autre organisme "
                                "que celui du SOA."
            })
        return attrs

    def create(self, validated_data):
        with transaction.atomic():
            # Verrou sur la ligne : le contrôle du solde et la décrémentation sont atomiques
            ligne = LigneBudgetaire.objects.select_for_update().get(
                pk=validated_data['ligne_budget'].pk
            )
            montant = validated_data['montant_engage']
            if montant > ligne.montant_disponible:
                raise serializers.ValidationError({
                    'montant_engage': f"Crédit insuffisant : disponible {ligne.montant_disponible} Ar."
                })
            ligne.montant_disponible -= montant
            ligne.save(update_fields=['montant_disponible'])
            validated_data['ligne_budget'] = ligne
            return super().create(validated_data)