from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.stock import services
from apps.stock.models import ReservationStock


class Command(BaseCommand):
    help = "Libère les réservations de stock dont la date limite est dépassée."

    def handle(self, *args, **options):
        n = 0
        for reservation in ReservationStock.objects.filter(date_limite__lt=timezone.now()):
            with transaction.atomic():
                services.liberer(reservation)
            n += 1
        self.stdout.write(self.style.SUCCESS(f'{n} réservation(s) libérée(s).'))