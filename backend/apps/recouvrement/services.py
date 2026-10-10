from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db.models import Q
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
        lever_blocage_auto(dossier)
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


# ------------------------------------------------- blocage automatique (INM)
def _clients_dossier(dossier):
    """Clients distincts des factures du dossier (verrouillés)."""
    from apps.clients.models import Client
    ids = set(
        LigneRecouvrement.objects.filter(recouvrement=dossier).select_related(
            'facture__commande__client', 'facture__client'
        ).values_list('facture__commande__client_id', 'facture__client_id')
    )
    client_ids = {i for couple in ids for i in couple if i}
    return list(
        Client.objects.select_for_update().filter(pk__in=client_ids)
    )


def bloquer_client(dossier):
    """Un dossier en CONTENTIEUX bloque automatiquement ses clients PRIVE.

    Seul le blocage automatique est posé ici (`blocage_auto=True`) : un blocage
    manuel du comptable n'est jamais levé automatiquement.
    """
    from apps.clients.models import SolvabiliteClient
    for client in _clients_dossier(dossier):
        if client.type_client != Client.TypeClient.PRIVE:
            continue
        solv, _ = SolvabiliteClient.objects.select_for_update().get_or_create(
            client=client,
            defaults={'score_credit': ZERO, 'plafond_encours': ZERO,
                      'statut_blocage': SolvabiliteClient.BLOCAGE_ACTIF},
        )
        if solv.statut_blocage != SolvabiliteClient.BLOCAGE_BLOQUE or not solv.blocage_auto:
            solv.statut_blocage = SolvabiliteClient.BLOCAGE_BLOQUE
            solv.blocage_auto = True
            solv.save(update_fields=['statut_blocage', 'blocage_auto'])


def lever_blocage_auto(dossier):
    """Un dossier soldé lève le blocage auto, sauf autre dossier CONTENTIEUX actif."""
    from apps.clients.models import SolvabiliteClient
    for client in _clients_dossier(dossier):
        autres = LigneRecouvrement.objects.filter(
            facture__commande__client=client,
            recouvrement__statut_dossier=Recouvrement.Statut.CONTENTIEUX,
        ).exclude(recouvrement=dossier).exists() or LigneRecouvrement.objects.filter(
            facture__client=client,
            recouvrement__statut_dossier=Recouvrement.Statut.CONTENTIEUX,
        ).exclude(recouvrement=dossier).exists()
        if autres:
            continue
        try:
            solv = SolvabiliteClient.objects.select_for_update().get(client=client)
        except SolvabiliteClient.DoesNotExist:
            continue
        if solv.blocage_auto:
            solv.statut_blocage = SolvabiliteClient.BLOCAGE_ACTIF
            solv.blocage_auto = False
            solv.save(update_fields=['statut_blocage', 'blocage_auto'])


def client_bloque(client):
    """Vrai si la fiche de solvabilité du client est bloquée (auto ou manuelle)."""
    solv = getattr(client, 'solvabilite', None)
    return bool(solv and solv.statut_blocage == solv.BLOCAGE_BLOQUE)


def client_en_contentieux(client):
    """Vrai si une facture du client est dans un dossier CONTENTIEUX."""
    return LigneRecouvrement.objects.filter(
        recouvrement__statut_dossier=Recouvrement.Statut.CONTENTIEUX,
    ).filter(
        Q(facture__commande__client=client) | Q(facture__client=client)
    ).exists()