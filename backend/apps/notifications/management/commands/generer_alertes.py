from django.core.management.base import BaseCommand

from apps.notifications import alertes


class Command(BaseCommand):
    help = "Génère les alertes périodiques (ruptures, impayés échus, relances). Sans doublon dans la journée."

    def handle(self, *args, **options):
        r = alertes.generer()
        self.stdout.write(self.style.SUCCESS(
            f"Notifications créées : ruptures {r['ruptures']}, impayés {r['impayes']}, relances {r['relances']}."
        ))