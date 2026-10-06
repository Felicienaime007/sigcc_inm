from django.contrib import admin

from .models import LigneRecouvrement, Recouvrement


class LigneInline(admin.TabularInline):
    model = LigneRecouvrement
    extra = 0
    readonly_fields = ('facture', 'montant_a_recouvrer')
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Recouvrement)
class RecouvrementAdmin(admin.ModelAdmin):
    list_display = ('num_dossier', 'niveau_relance', 'statut_dossier', 'date_relance')
    list_filter = ('statut_dossier', 'niveau_relance')
    search_fields = ('num_dossier',)
    # Les dossiers évoluent uniquement par l'API (relancer / escalader)
    readonly_fields = ('num_dossier', 'date_relance', 'niveau_relance', 'statut_dossier')
    inlines = [LigneInline]

    def has_add_permission(self, request):
        return False