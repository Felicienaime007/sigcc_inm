from django.contrib import admin

from .models import Caisse, LivreCaisse, LivreQuittance, Quittance, Reglement


class LectureSeule(admin.ModelAdmin):
    """Écritures financières : créées uniquement par l'API."""
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Caisse)
class CaisseAdmin(LectureSeule):
    list_display = ('code_caisse', 'libelle_caisse', 'solde_actuel')


@admin.register(LivreQuittance)
class LivreQuittanceAdmin(admin.ModelAdmin):
    list_display = ('numero_livre', 'annee_ouverture', 'statut_livre')


@admin.register(Reglement)
class ReglementAdmin(LectureSeule):
    list_display = ('id_reglement', 'facture', 'mode_reglement', 'montant_regle', 'date_reglement')
    list_filter = ('mode_reglement',)


@admin.register(Quittance)
class QuittanceAdmin(LectureSeule):
    list_display = ('livre', 'num_feuille', 'attribut_volet', 'caisse', 'date_emission')
    list_filter = ('livre',)


@admin.register(LivreCaisse)
class LivreCaisseAdmin(LectureSeule):
    list_display = ('date_operation', 'caisse', 'type_operation', 'montant_op', 'reference')
    list_filter = ('type_operation', 'caisse')