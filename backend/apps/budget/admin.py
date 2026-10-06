from django.contrib import admin

from .models import (
    Budget, EngagementBudget, LigneBudgetaire, PrevisionBudgetaire, TypeFinancement,
)


@admin.register(TypeFinancement)
class TypeFinancementAdmin(admin.ModelAdmin):
    list_display = ('libelle_financement',)


@admin.register(Budget)
class BudgetAdmin(admin.ModelAdmin):
    list_display = ('organisme', 'annee_budgetaire', 'montant_alloue')
    list_filter = ('annee_budgetaire',)


@admin.register(LigneBudgetaire)
class LigneBudgetaireAdmin(admin.ModelAdmin):
    list_display = ('code_article', 'libelle_ligne', 'budget', 'montant_disponible')
    search_fields = ('code_article', 'libelle_ligne')


@admin.register(PrevisionBudgetaire)
class PrevisionBudgetaireAdmin(admin.ModelAdmin):
    list_display = ('ligne_budget', 'periode', 'montant_estime')


@admin.register(EngagementBudget)
class EngagementBudgetAdmin(admin.ModelAdmin):
    list_display = ('num_engagement_cf', 'client', 'montant_engage', 'statut_engagement')
    list_filter = ('statut_engagement',)
    # Les engagements se créent par l'API (mise à jour du solde de la ligne)
    readonly_fields = ('ligne_budget', 'client', 'montant_engage', 'statut_engagement')

    def has_add_permission(self, request):
        return False