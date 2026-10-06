from django import forms
from django.contrib import admin

from .models import Privilege, Role, RolePrivilege, Utilisateur, UtilisateurRole


class UtilisateurRoleInline(admin.TabularInline):
    model = UtilisateurRole
    extra = 1


class RolePrivilegeInline(admin.TabularInline):
    model = RolePrivilege
    extra = 1


class UtilisateurAdminForm(forms.ModelForm):
    nouveau_mot_de_passe = forms.CharField(
        required=False, widget=forms.PasswordInput,
        help_text="Laisser vide pour ne pas modifier.",
    )

    class Meta:
        model = Utilisateur
        fields = ('matricule', 'nom_complet', 'identifiant', 'statut_compte')


@admin.register(Utilisateur)
class UtilisateurAdmin(admin.ModelAdmin):
    form = UtilisateurAdminForm
    list_display = ('identifiant', 'matricule', 'nom_complet', 'statut_compte')
    list_filter = ('statut_compte', 'roles')
    search_fields = ('identifiant', 'matricule', 'nom_complet')
    inlines = [UtilisateurRoleInline]

    def save_model(self, request, obj, form, change):
        pwd = form.cleaned_data.get('nouveau_mot_de_passe')
        if pwd:
            obj.set_password(pwd)
        elif not change:
            obj.set_unusable_password()
        super().save_model(request, obj, form, change)


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ('libelle_role',)
    inlines = [RolePrivilegeInline]


@admin.register(Privilege)
class PrivilegeAdmin(admin.ModelAdmin):
    list_display = ('code_action', 'description')
    search_fields = ('code_action',)