from django.contrib import admin

from .models import Client, Organisme, SolvabiliteClient


@admin.register(Organisme)
class OrganismeAdmin(admin.ModelAdmin):
    list_display = ('nom_organisme', 'code_institutionnel')
    search_fields = ('nom_organisme', 'code_institutionnel')


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ('nom_client', 'type_client', 'code_soa', 'telephone')
    list_filter = ('type_client',)
    search_fields = ('nom_client', 'code_soa', 'cin_ou_nif')


@admin.register(SolvabiliteClient)
class SolvabiliteClientAdmin(admin.ModelAdmin):
    list_display = ('client', 'score_credit', 'plafond_encours', 'statut_blocage')
    list_filter = ('statut_blocage',)
