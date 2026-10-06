from django.contrib import admin

from .models import CategorieProduit, ConfigSerieDocument, LotLancementSerie, ProduitFini


@admin.register(CategorieProduit)
class CategorieProduitAdmin(admin.ModelAdmin):
    list_display = ('libelle_categorie',)


@admin.register(ConfigSerieDocument)
class ConfigSerieAdmin(admin.ModelAdmin):
    list_display = ('id_config', 'prefixe_courant', 'dernier_numero_valide')


@admin.register(ProduitFini)
class ProduitFiniAdmin(admin.ModelAdmin):
    list_display = ('code_produit', 'designation', 'prix_tarif', 'categorie', 'config')
    list_filter = ('categorie',)
    search_fields = ('code_produit', 'designation')


@admin.register(LotLancementSerie)
class LotAdmin(admin.ModelAdmin):
    list_display = ('num_lot', 'produit', 'num_debut', 'num_fin', 'statut_prod')
    list_filter = ('statut_prod',)
    # Les lots se lancent par l'API (mise à jour du compteur de la config)
    readonly_fields = [f.name for f in LotLancementSerie._meta.fields]

    def has_add_permission(self, request):
        return False