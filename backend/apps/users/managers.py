from django.contrib.auth.models import BaseUserManager


class UtilisateurManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, identifiant, password=None, **extra_fields):
        if not identifiant:
            raise ValueError("L'identifiant est obligatoire.")
        extra_fields.setdefault('statut_compte', 'ACTIF')
        user = self.model(identifiant=identifiant, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, identifiant, password=None, **extra_fields):
        from .models import Role  

        user = self.create_user(identifiant, password, **extra_fields)
        role_admin, _ = Role.objects.get_or_create(libelle_role='ADMIN')
        user.roles.add(role_admin)
        return user