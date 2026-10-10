"""Alertes périodiques (une fois par jour et par alerte). Planifier : python manage.py generer_alertes"""
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db.models import Sum
from django.utils import timezone

from apps.commercial.models import Facture
from apps.recouvrement import services as rec
from apps.recouvrement.models import Recouvrement
from apps.stock.models import LigneStock

from . import services as s

ZERO = Decimal('0')
QUOTIDIEN = timedelta(hours=20)


def alerte_ruptures(jour):
    lignes = (
        LigneStock.objects.values('produit__code_produit', 'produit__designation')
        .annotate(p=Sum('quantite_physique'), r=Sum('quantite_reservee'))
    )
    ruptures = sorted(l['produit__code_produit'] for l in lignes if (l['p'] or 0) - (l['r'] or 0) <= 0)
    if not ruptures:
        return 0
    detail = ', '.join(ruptures[:6]) + (f" … (+{len(ruptures) - 6})" if len(ruptures) > 6 else '')
    return s.notifier('stock.rupture', f"{len(ruptures)} produit(s) en rupture ou entièrement réservés",
                      detail, lien='/stock', cle=f'rupture:{jour}', fenetre=QUOTIDIEN)


def alerte_impayes(jour):
    qs = (
        Facture.objects.filter(
            commande__client__type_client='PRIVE',
            statut_paiement__in=[Facture.StatutPaiement.NON_PAYEE, Facture.StatutPaiement.PARTIELLE],
        )
        .exclude(lignes_recouvrement__recouvrement__statut_dossier__in=rec.ACTIFS)
    )
    n, total = 0, ZERO
    for f in qs:
        du = rec.montant_du(f)
        if du > 0 and rec.jours_retard(f) > 0:
            n += 1
            total += du
    if not n:
        return 0
    return s.notifier('facture.echue', f"{n} facture(s) privée(s) échue(s) sans dossier",
                      f"Montant échu : {s.ar(total)}. Ouvrez un dossier de recouvrement.",
                      lien='/recouvrement', cle=f'echues:{jour}', fenetre=QUOTIDIEN)


def alerte_relances(jour):
    delai = getattr(settings, 'NOTIFICATION_RELANCE_JOURS', 15)
    n = Recouvrement.objects.filter(
        statut_dossier=Recouvrement.Statut.EN_COURS, date_relance__lte=jour - timedelta(days=delai)
    ).count()
    if not n:
        return 0
    return s.notifier('recouvrement.a_relancer', f"{n} dossier(s) à relancer",
                      f"Aucune relance depuis {delai} jours ou plus.",
                      lien='/recouvrement', cle=f'relancer:{jour}', fenetre=QUOTIDIEN)


def generer():
    jour = timezone.localdate()
    return {
        'ruptures': alerte_ruptures(jour),
        'impayes': alerte_impayes(jour),
        'relances': alerte_relances(jour),
    }