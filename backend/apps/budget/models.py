from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.clients.models import Client, Organisme

MONTANT = {'max_digits': 15, 'decimal_places': 2}


class TypeFinancement(models.Model):
    id_type_financement = models.AutoField(primary_key=True)
    libelle_financement = models.CharField(max_length=100, unique=True)

    class Meta:
        db_table = 'type_financement'
        ordering = ['libelle_financement']

    def __str__(self):
        return self.libelle_financement


class Budget(models.Model):
    id_budget = models.AutoField(primary_key=True)
    annee_budgetaire = models.PositiveIntegerField(
        validators=[MinValueValidator(2000), MaxValueValidator(2100)]
    )
    montant_alloue = models.DecimalField(**MONTANT, validators=[MinValueValidator(0)])
    organisme = models.ForeignKey(
        Organisme, on_delete=models.PROTECT,
        db_column='id_organisme', related_name='budgets',
    )

    class Meta:
        db_table = 'budget'
        ordering = ['-annee_budgetaire', 'organisme__nom_organisme']
        constraints = [
            models.UniqueConstraint(
                fields=['organisme', 'annee_budgetaire'], name='uk_budget_org_annee'
            )
        ]

    def __str__(self):
        return f'Budget {self.annee_budgetaire} - {self.organisme.nom_organisme}'


class LigneBudgetaire(models.Model):
    id_ligne_budget = models.AutoField(primary_key=True)
    code_article = models.CharField(max_length=50)
    libelle_ligne = models.CharField(max_length=255)
    # Solde courant : diminue à chaque engagement visé, remonte à l'annulation
    montant_disponible = models.DecimalField(**MONTANT, validators=[MinValueValidator(0)])
    budget = models.ForeignKey(
        Budget, on_delete=models.PROTECT,
        db_column='id_budget', related_name='lignes',
    )
    type_financement = models.ForeignKey(
        TypeFinancement, on_delete=models.PROTECT, null=True, blank=True,
        db_column='id_type_financement', related_name='lignes',
    )

    class Meta:
        db_table = 'ligne_budgetaire'
        ordering = ['budget', 'code_article']
        constraints = [
            models.UniqueConstraint(
                fields=['budget', 'code_article'], name='uk_ligne_budget_article'
            )
        ]

    def __str__(self):
        return f'{self.code_article} - {self.libelle_ligne}'


class PrevisionBudgetaire(models.Model):
    id_prevision = models.AutoField(primary_key=True)
    montant_estime = models.DecimalField(**MONTANT, validators=[MinValueValidator(0)])
    periode = models.CharField(max_length=50)          # ex : "2026-T1", "2026-S2"
    ligne_budget = models.ForeignKey(
        LigneBudgetaire, on_delete=models.PROTECT,
        db_column='id_ligne_budget', related_name='previsions',
    )

    class Meta:
        db_table = 'prevision_budgetaire'
        ordering = ['ligne_budget', 'periode']
        constraints = [
            models.UniqueConstraint(
                fields=['ligne_budget', 'periode'], name='uk_prevision_ligne_periode'
            )
        ]

    def __str__(self):
        return f'{self.periode} : {self.montant_estime}'


class EngagementBudget(models.Model):
    class Statut(models.TextChoices):
        VISE = 'VISE', 'Visé par le CF'
        SOLDE = 'SOLDE', 'Soldé (consommé)'
        ANNULE = 'ANNULE', 'Annulé'

    id_engagement = models.AutoField(primary_key=True)
    num_engagement_cf = models.CharField(max_length=100, unique=True)
    montant_engage = models.DecimalField(
        **MONTANT, validators=[MinValueValidator(Decimal('0.01'))]
    )
    date_visa_cf = models.DateField()
    statut_engagement = models.CharField(
        max_length=30, choices=Statut.choices, default=Statut.VISE
    )
    ligne_budget = models.ForeignKey(
        LigneBudgetaire, on_delete=models.PROTECT,
        db_column='id_ligne_budget', related_name='engagements',
    )
    client = models.ForeignKey(
        Client, on_delete=models.PROTECT,
        db_column='id_client', related_name='engagements',
    )

    class Meta:
        db_table = 'engagement_budget'
        ordering = ['-date_visa_cf', '-id_engagement']
        indexes = [models.Index(fields=['statut_engagement'], name='idx_engagement_statut')]

    def __str__(self):
        return f'{self.num_engagement_cf} ({self.montant_engage})'