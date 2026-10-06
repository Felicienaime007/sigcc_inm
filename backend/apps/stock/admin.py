from django.contrib import admin

from .models import Emplacement, LigneStock, MagasinDepot, MouvementStock, ReservationStock


@admin.register(MagasinDepot)
class MagasinAdmin(admin.ModelAdmin):
    list_display = ('code_depot', 'nom_magasin')


@admin.register(Emplacement)
class EmplacementAdmin(admin.ModelAdmin):
    list_display = ('magasin', 'code_allee', 'code_etagere')
    list_filter = ('magasin',)


class LectureSeule(admin.ModelAdmin):
    """Le stock ne se modifie que par les services (mouvements)."""
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(LigneStock)
class LigneStockAdmin(LectureSeule):
    list_display = ('produit', 'emplacement', 'quantite_physique', 'quantite_reservee')


@admin.register(ReservationStock)
class ReservationAdmin(LectureSeule):
    list_display = ('produit', 'quantite_bloquee', 'preparation', 'date_limite')


@admin.register(MouvementStock)
class MouvementAdmin(LectureSeule):
    list_display = ('date_mouv', 'type_mouvement', 'produit', 'quantite_mouv', 'reference')
    list_filter = ('type_mouvement',)