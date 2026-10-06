from decimal import Decimal

from django.db.models import DecimalField, ExpressionWrapper, F, Sum
from django.utils import timezone
from apps.tresorerie.services import reste_a_payer 
from .models import Commande, Facture

ZERO = Decimal('0')


def numero(prefixe, obj, date_heure):
    """Ex : BL-2026-00012 (l'année est celle du fuseau local)."""
    return f'{prefixe}-{timezone.localtime(date_heure).year}-{obj.pk:05d}'


def encours_client(client):
    """
    Engagement financier (HT) d'un client PRIVE, hors commande en cours de validation :
    - commandes validées / en préparation / livrées, pas encore facturées
    - factures non payées ou partiellement payées
    Sera affiné avec le module trésorerie (prise en compte des règlements partiels).
    """
    montant = ExpressionWrapper(
        F('lignes__quantite_commandee') * F('lignes__prix_unitaire_facture'),
        output_field=DecimalField(max_digits=20, decimal_places=2),
    )
    en_cours = Commande.objects.filter(
        client=client,
        statut_commande__in=[
            Commande.Statut.VALIDEE, Commande.Statut.EN_PREPARATION, Commande.Statut.LIVREE,
        ],
    ).aggregate(t=Sum(montant))['t'] or ZERO

    impayees = ZERO
    for facture in Facture.objects.filter(
        commande__client=client,
        statut_paiement__in=[
            Facture.StatutPaiement.NON_PAYEE, Facture.StatutPaiement.PARTIELLE,
        ],
    ):
        impayees += max(reste_a_payer(facture), ZERO)

    return en_cours + impayees


def apres_livraison(bon_livraison):
    """Sortie de stock (et consommation de la réservation) pour chaque ligne du BL."""
    from apps.stock.services import sortie_livraison   # import local : évite un cycle
    sortie_livraison(bon_livraison)