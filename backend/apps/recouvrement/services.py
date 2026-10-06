from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.utils import timezone

from apps.clients.models import Client
from apps.tresorerie.services import reste_a_payer

from .models import LigneRecouvrement, Recouvrement

ZERO = Decimal('0')
ACTIFS = [Recouvrement.Statut.EN_COURS, Recouvrement.Statut.CONTENTIEUX]


def delai_jours():
    return getattr(settings, 'RECOUVREMENT_DELAI_JOURS', 30)


def echeance(facture):
    return timezone.localtime(facture.date_facture).date() + timedelta(days=delai_jours())


def jours_retard(facture):
    return max((timezone.localdate() - echeance(facture)).days, 0)


def montant_du(facture):
    return max(reste_a_payer(facture), ZERO)


def erreurs_facture(facture):
    """Liste des raisons pour lesquelles la facture ne peut pas entrer en recouvrement."""
    num = facture.num_facture
    if facture.commande_id is None or \
            facture.commande.client.type_client != Client.TypeClient.PRIVE:
        return [f"{num} : n'est pas une facture de client PRIVE."]
    erreurs = []
    if montant_du(facture) <= ZERO:
        erreurs.append(f"{num} : déjà soldée.")
    elif echeance(facture) >= timezone.localdate():
        erreurs.append(f"{num} : non échue (échéance le {echeance(facture)}).")
    if LigneRecouvrement.objects.filter(
        facture=facture, recouvrement__statut_dossier__in=ACTIFS
    ).exists():
        erreurs.append(f"{num} : déjà dans un dossier de recouvrement actif.")
    return erreurs


def actualiser(dossier):
    """Recalcule les soldes ; passe le dossier à REGLE si tout est soldé."""
    lignes = list(dossier.lignes.select_related('facture'))
    for l in lignes:
        m = montant_du(l.facture)
        if m != l.montant_a_recouvrer:
            l.montant_a_recouvrer = m
            l.save(update_fields=['montant_a_recouvrer'])
    if lignes and all(l.montant_a_recouvrer == ZERO for l in lignes) \
            and dossier.statut_dossier != Recouvrement.Statut.REGLE:
        dossier.statut_dossier = Recouvrement.Statut.REGLE
        dossier.save(update_fields=['statut_dossier'])
    return dossier


def apres_reglement(facture):
    """Appelée après chaque règlement : synchronise les dossiers actifs de la facture."""
    ids = list(
        LigneRecouvrement.objects.filter(
            facture=facture, recouvrement__statut_dossier__in=ACTIFS
        ).values_list('recouvrement_id', flat=True)
    )
    for dossier in Recouvrement.objects.select_for_update().filter(pk__in=ids):
        actualiser(dossier)