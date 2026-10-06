from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings
from django.db.models import Sum

from apps.commercial.models import LigneAvoir

from .models import Reglement

ZERO = Decimal('0')
CENTIMES = Decimal('0.01')


def _taux():
    return getattr(settings, 'TVA_TAUX', Decimal('0.20'))


def total_avoirs_ttc(facture):
    ht = LigneAvoir.objects.filter(avoir__facture=facture).aggregate(
        t=Sum('montant_avoir'))['t'] or ZERO
    return ht + (ht * _taux()).quantize(CENTIMES, rounding=ROUND_HALF_UP)


def total_regle(facture):
    return Reglement.objects.filter(facture=facture).aggregate(
        t=Sum('montant_regle'))['t'] or ZERO


def net_a_payer(facture):
    """TTC de la facture moins les avoirs (TTC)."""
    return facture.montant_ht + facture.tva - total_avoirs_ttc(facture)


def reste_a_payer(facture):
    return net_a_payer(facture) - total_regle(facture)