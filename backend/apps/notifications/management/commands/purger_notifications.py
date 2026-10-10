from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from apps.notifications.models import Notification


class Command(BaseCommand):
    help = "Supprime les notifications anciennes (lues depuis N jours, ou toutes avec --tout)."

    def add_arguments(self, parser):
        parser.add_argument('--jours', type=int, default=60, help="Ancienneté en jours (défaut : 60).")
        parser.add_argument('--tout', action='store_true', help="Supprime toutes les notifications.")

    def handle(self, *args, **options):
        if options['tout']:
            n, _ = Notification.objects.all().delete()
        else:
            limite = timezone.now() - timedelta(days=options['jours'])
            # lues anciennes ; les non lues ne sont supprimées qu'au bout de 6 mois
            n, _ = Notification.objects.filter(
                Q(lu_le__lt=limite) | Q(cree_le__lt=timezone.now() - timedelta(days=180))
            ).delete()
        self.stdout.write(self.style.SUCCESS(f"{n} notification(s) supprimée(s)."))