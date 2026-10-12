from django.contrib.auth.models import AbstractBaseUser
from django.db import models

from .managers import UtilisateurManager


class Privilege(models.Model):
    id_privilege = models.AutoField(primary_key=True)
    code_action = models.CharField(max_length=100, unique=True)   
    description = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'privilege'
        ordering = ['code_action']

    def __str__(self):
        return self.code_action


class Role(models.Model):
    id_role = models.AutoField(primary_key=True)
    libelle_role = models.CharField(max_length=50, unique=True)
    privileges = models.ManyToManyField(
        Privilege, through='RolePrivilege', related_name='roles', blank=True
    )

    class Meta:
        db_table = 'role'
        ordering = ['libelle_role']

    def __str__(self):
        return self.libelle_role


class Utilisateur(AbstractBaseUser):
    class Statut(models.TextChoices):
        ACTIF = 'ACTIF', 'Actif'
        INACTIF = 'INACTIF', 'Inactif'
        SUSPENDU = 'SUSPENDU', 'Suspendu'

    id_utilisateur = models.AutoField(primary_key=True)
    matricule = models.CharField(max_length=50, unique=True)
    nom_complet = models.CharField(max_length=150)
    identifiant = models.CharField(max_length=50, unique=True)
    # Surcharge du champ `password` pour coller au MLD (colonne mot_de_passe)
    password = models.CharField('mot de passe', max_length=255, db_column='mot_de_passe')
    statut_compte = models.CharField(
        max_length=20, choices=Statut.choices, default=Statut.ACTIF
    )
    # Photo de profil (data URL base64, image réduite ≤ 256 px) : stockée en
    # base pour survivre au vidage du navigateur et suivre l'utilisateur.
    photo = models.TextField(null=True, blank=True)
    roles = models.ManyToManyField(
        Role, through='UtilisateurRole', related_name='utilisateurs', blank=True
    )

    objects = UtilisateurManager()

    USERNAME_FIELD = 'identifiant'
    REQUIRED_FIELDS = ['matricule', 'nom_complet']

    class Meta:
        db_table = 'utilisateur'
        ordering = ['nom_complet']

    def __str__(self):
        return f'{self.nom_complet} ({self.identifiant})'

    # ---- Statut du compte ----
    @property
    def is_active(self):
        return self.statut_compte == self.Statut.ACTIF

    # ---- RBAC ----
    @property
    def role_codes(self):
        return list(self.roles.values_list('libelle_role', flat=True))

    @property
    def is_admin(self):
        return self.roles.filter(libelle_role='ADMIN').exists()

    def get_privileges(self):
        """Ensemble des code_action accordés via les rôles de l'utilisateur."""
        return set(
            Privilege.objects.filter(roles__utilisateurs=self)
            .values_list('code_action', flat=True)
        )

    def has_privilege(self, code_action):
        if not self.is_active:
            return False
        if self.is_admin:
            return True
        return code_action in self.get_privileges()

    # ---- Compatibilité django.contrib.admin ----
    @property
    def is_staff(self):
        return self.is_active and self.is_admin

    def has_perm(self, perm, obj=None):
        return self.is_staff

    def has_module_perms(self, app_label):
        return self.is_staff


class UtilisateurRole(models.Model):
    """Table de liaison UTILISATEUR_ROLE."""
    utilisateur = models.ForeignKey(
        Utilisateur, on_delete=models.CASCADE, db_column='id_utilisateur'
    )
    role = models.ForeignKey(Role, on_delete=models.CASCADE, db_column='id_role')

    class Meta:
        db_table = 'utilisateur_role'
        constraints = [
            models.UniqueConstraint(
                fields=['utilisateur', 'role'], name='uk_utilisateur_role'
            )
        ]


class RolePrivilege(models.Model):
    """Table de liaison ROLE_PRIVILEGE."""
    role = models.ForeignKey(Role, on_delete=models.CASCADE, db_column='id_role')
    privilege = models.ForeignKey(
        Privilege, on_delete=models.CASCADE, db_column='id_privilege'
    )

    class Meta:
        db_table = 'role_privilege'
        constraints = [
            models.UniqueConstraint(
                fields=['role', 'privilege'], name='uk_role_privilege'
            )
        ]