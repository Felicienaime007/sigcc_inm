from django.contrib import admin

from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = (
        'date_audit', 'identifiant_utilisateur', 'operation',
        'table_nom', 'id_objet', 'reference',
    )
    list_filter = ('operation', 'table_nom')
    search_fields = ('identifiant_utilisateur', 'reference', 'id_objet')
    date_hierarchy = 'date_audit'

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False