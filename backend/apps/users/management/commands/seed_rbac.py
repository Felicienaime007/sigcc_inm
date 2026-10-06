from django.core.management.base import BaseCommand
from django.db import transaction

from apps.users.models import Privilege, Role, RolePrivilege
from apps.users.rbac_catalog import PRIVILEGES, ROLES, ROLE_PRIVILEGES


class Command(BaseCommand):
    help = "Initialise (idempotent) les privilèges et rôles du SIGCC."

    @transaction.atomic
    def handle(self, *args, **options):
        for code, desc in PRIVILEGES:
            Privilege.objects.update_or_create(
                code_action=code, defaults={'description': desc}
            )
        self.stdout.write(f'{len(PRIVILEGES)} privilèges synchronisés.')

        for libelle in ROLES:
            Role.objects.get_or_create(libelle_role=libelle)
        self.stdout.write(f'{len(ROLES)} rôles synchronisés.')

        for libelle, codes in ROLE_PRIVILEGES.items():
            role = Role.objects.get(libelle_role=libelle)
            qs = (
                Privilege.objects.all()
                if '*' in codes
                else Privilege.objects.filter(code_action__in=codes)
            )
            for priv in qs:
                RolePrivilege.objects.get_or_create(role=role, privilege=priv)

        self.stdout.write(self.style.SUCCESS('RBAC initialisé.'))