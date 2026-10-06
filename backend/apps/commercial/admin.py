from django.contrib import admin

from .models import (
    Commande, DevisProforma, LigneCommande, LigneDevis, LignePlanification,
    PlanificationBesoin, Avoir, LigneAvoir, Facture, LigneFacture, BonLivraison, LigneLivraison, 
    PreparationCommande, LignePreparation,
)


class LignePlanifInline(admin.TabularInline):
    model = LignePlanification
    extra = 0


class LigneDevisInline(admin.TabularInline):
    model = LigneDevis
    extra = 0


class LigneCommandeInline(admin.TabularInline):
    model = LigneCommande
    extra = 0
class LecturSeule(admin.ModelAdmin):
    """Documents générés par l'API : consultation uniquement."""
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


class LignePrepInline(admin.TabularInline):
    model = LignePreparation
    extra = 0

@admin.register(PlanificationBesoin)
class PlanificationAdmin(admin.ModelAdmin):
    list_display = ('client', 'periode_cible', 'date_planif')
    inlines = [LignePlanifInline]


@admin.register(DevisProforma)
class DevisAdmin(admin.ModelAdmin):
    list_display = ('num_devis', 'client', 'date_devis', 'validite_jours')
    search_fields = ('num_devis', 'client__nom_client')
    inlines = [LigneDevisInline]


@admin.register(Commande)
class CommandeAdmin(admin.ModelAdmin):
    list_display = ('num_commande', 'client', 'date_commande', 'statut_commande')
    list_filter = ('statut_commande',)
    search_fields = ('num_commande', 'client__nom_client')
    # Le statut et l'engagement évoluent uniquement par l'API (valider / annuler)
    readonly_fields = ('statut_commande', 'engagement')
    inlines = [LigneCommandeInline]

@admin.register(PreparationCommande)
class PreparationAdmin(LecturSeule):
    list_display = ('id_preparation', 'commande', 'statut_prepa', 'date_prepa')
    inlines = [LignePrepInline]


@admin.register(BonLivraison)
class BonLivraisonAdmin(LecturSeule):
    list_display = ('num_bl', 'preparation', 'facture', 'date_livraison')


@admin.register(Facture)
class FactureAdmin(LecturSeule):
    list_display = ('num_facture', 'type_facturation', 'montant_ht', 'tva', 'statut_paiement')
    list_filter = ('type_facturation', 'statut_paiement')
    search_fields = ('num_facture',)


@admin.register(Avoir)
class AvoirAdmin(LecturSeule):
    list_display = ('num_avoir', 'facture', 'date_avoir')