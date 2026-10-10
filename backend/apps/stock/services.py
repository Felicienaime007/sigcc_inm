from datetime import timedelta

from django.conf import settings
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.produits.models import ProduitFini

from .models import LigneStock, MouvementStock, ReservationStock

T = MouvementStock.Type


# ------------------------------------------------------------------- Utilitaires
def _verrou(produit_id):
    """Verrouille le produit puis ses lignes de stock (mutex par produit)."""
    produit = ProduitFini.objects.select_for_update().get(pk=produit_id)
    lignes = list(
        LigneStock.objects.select_for_update().filter(produit_id=produit_id).order_by('pk')
    )
    return produit, lignes


def _libre(lignes):
    return sum(l.quantite_physique - l.quantite_reservee for l in lignes)


def _par_libre_desc(lignes):
    return sorted(lignes, key=lambda l: l.quantite_physique - l.quantite_reservee, reverse=True)


def _prendre(lignes, qte):
    """Retire du physique, dans la limite du libre de chaque ligne."""
    reste = qte
    for l in _par_libre_desc(lignes):
        prise = min(reste, l.quantite_physique - l.quantite_reservee)
        if prise > 0:
            l.quantite_physique -= prise
            l.save(update_fields=['quantite_physique'])
            reste -= prise
        if reste == 0:
            break


def _bloquer(lignes, qte):
    reste = qte
    for l in _par_libre_desc(lignes):
        prise = min(reste, l.quantite_physique - l.quantite_reservee)
        if prise > 0:
            l.quantite_reservee += prise
            l.save(update_fields=['quantite_reservee'])
            reste -= prise
        if reste == 0:
            break


def _debloquer(lignes, qte):
    reste = qte
    for l in lignes:
        if reste == 0:
            break
        rendu = min(reste, l.quantite_reservee)
        if rendu > 0:
            l.quantite_reservee -= rendu
            l.save(update_fields=['quantite_reservee'])
            reste -= rendu


def _mouvement(type_, produit_id, qte, emplacement=None, livraison=None, reference=None):
    return MouvementStock.objects.create(
        type_mouvement=type_, quantite_mouv=qte, date_mouv=timezone.now(),
        produit_id=produit_id, emplacement=emplacement,
        livraison=livraison, reference=reference,
    )


def _insuffisant(produit, demande, libre):
    return ValidationError({
        'detail': f"Stock insuffisant pour {produit.code_produit} : "
                  f"demandé {demande}, disponible {libre}."
    })


def disponible(produit_id):
    a = LigneStock.objects.filter(produit_id=produit_id).aggregate(
        p=Sum('quantite_physique'), r=Sum('quantite_reservee')
    )
    return (a['p'] or 0) - (a['r'] or 0)


def emplacement_par_defaut(produit_id):
    ligne = (
        LigneStock.objects.filter(produit_id=produit_id)
        .select_related('emplacement').order_by('-quantite_physique').first()
    )
    return ligne.emplacement if ligne else None


# ------------------------------------------------------------ Entrées / sorties
def entree(produit_id, qte, emplacement, type_, reference=None):
    produit, lignes = _verrou(produit_id)
    ligne = next((l for l in lignes if l.emplacement_id == emplacement.pk), None)
    if ligne is None:
        LigneStock.objects.create(
            emplacement=emplacement, produit_id=produit_id, quantite_physique=qte
        )
    else:
        ligne.quantite_physique += qte
        ligne.save(update_fields=['quantite_physique'])
    return _mouvement(type_, produit_id, qte, emplacement=emplacement, reference=reference)


def sortie(produit_id, qte, type_, livraison=None, reference=None,
           emplacement=None, reservation=None):
    """
    Sort `qte` du stock. Si `reservation` est fournie, elle est consommée d'abord.
    Si `emplacement` est fourni, la sortie se fait uniquement sur cet emplacement.
    """
    produit, lignes = _verrou(produit_id)
    liberee = 0
    if reservation is not None:
        reservation = ReservationStock.objects.select_for_update().get(pk=reservation.pk)
        liberee = min(reservation.quantite_bloquee, qte)

    cibles = [l for l in lignes if emplacement is None or l.emplacement_id == emplacement.pk]
    libre = _libre(cibles) + liberee
    if qte > libre:
        raise _insuffisant(produit, qte, libre)

    if liberee:
        _debloquer(lignes, liberee)
        reservation.quantite_bloquee -= liberee
        if reservation.quantite_bloquee == 0:
            reservation.delete()
        else:
            reservation.save(update_fields=['quantite_bloquee'])

    _prendre(cibles, qte)
    return _mouvement(type_, produit_id, qte, emplacement=emplacement,
                      livraison=livraison, reference=reference)


def transferer(produit_id, source, destination, qte, reference=None):
    produit, lignes = _verrou(produit_id)
    src = next((l for l in lignes if l.emplacement_id == source.pk), None)
    libre = (src.quantite_physique - src.quantite_reservee) if src else 0
    if qte > libre:
        raise _insuffisant(produit, qte, libre)
    src.quantite_physique -= qte
    src.save(update_fields=['quantite_physique'])

    dst = next((l for l in lignes if l.emplacement_id == destination.pk), None)
    if dst is None:
        LigneStock.objects.create(
            emplacement=destination, produit_id=produit_id, quantite_physique=qte
        )
    else:
        dst.quantite_physique += qte
        dst.save(update_fields=['quantite_physique'])
    _mouvement(T.TRANSFERT_SORTIE, produit_id, qte, emplacement=source, reference=reference)
    _mouvement(T.TRANSFERT_ENTREE, produit_id, qte, emplacement=destination, reference=reference)


# ------------------------------------------------------------------ Réservations
def reserver(produit_id, qte, date_limite=None, preparation=None):
    if date_limite is None:
        date_limite = timezone.now() + timedelta(
            days=getattr(settings, 'STOCK_RESERVATION_JOURS', 7)
        )
    produit, lignes = _verrou(produit_id)
    libre = _libre(lignes)
    if qte > libre:
        raise _insuffisant(produit, qte, libre)
    _bloquer(lignes, qte)

    resa = None
    if preparation is not None:
        # Pas de select_for_update ici : Oracle refuse LIMIT/OFFSET verrouillé.
        resa = ReservationStock.objects.filter(
            preparation=preparation, produit_id=produit_id
        ).first()
    if resa is not None:
        resa.quantite_bloquee += qte
        resa.date_limite = max(resa.date_limite, date_limite)
        resa.save(update_fields=['quantite_bloquee', 'date_limite'])
        return resa
    return ReservationStock.objects.create(
        quantite_bloquee=qte, date_limite=date_limite,
        preparation=preparation, produit_id=produit_id,
    )


def liberer(reservation):
    # .get() plutôt que .filter().first() : Oracle refuse LIMIT/OFFSET verrouillé.
    try:
        resa = ReservationStock.objects.select_for_update().get(pk=reservation.pk)
    except ReservationStock.DoesNotExist:
        return
    _, lignes = _verrou(resa.produit_id)
    _debloquer(lignes, resa.quantite_bloquee)
    resa.delete()


def liberer_preparation(preparation):
    for r in ReservationStock.objects.filter(preparation=preparation):
        liberer(r)


def reserver_preparation(preparation, date_limite=None):
    """Tout ou rien : réserve le complément pour chaque ligne de la préparation."""
    besoins, manques = [], []
    for l in preparation.lignes.select_related('produit'):
        deja = ReservationStock.objects.filter(
            preparation=preparation, produit_id=l.produit_id
        ).aggregate(q=Sum('quantite_bloquee'))['q'] or 0
        reste = l.quantite_preparee - deja
        if reste > 0:
            dispo = disponible(l.produit_id)
            if reste > dispo:
                manques.append({'produit': l.produit.code_produit, 'manquant': reste - dispo})
            else:
                besoins.append((l.produit_id, reste))
    if manques:
        raise ValidationError({
            'detail': "Stock insuffisant pour réserver la préparation.",
            'manques': manques,
        })
    for produit_id, qte in besoins:
        reserver(produit_id, qte, date_limite, preparation)


def manques_reservation(preparation):
    """Codes produits des lignes non entièrement réservées."""
    manques = []
    for l in preparation.lignes.select_related('produit'):
        reserve = ReservationStock.objects.filter(
            preparation=preparation, produit_id=l.produit_id
        ).aggregate(q=Sum('quantite_bloquee'))['q'] or 0
        if reserve < l.quantite_preparee:
            manques.append(l.produit.code_produit)
    return manques


# ---------------------------------------------------- Branchements sur le commercial
def sortie_livraison(bl):
    """Appelée à la création d'un bon de livraison."""
    for l in bl.lignes.select_related('produit'):
        resa = None
        if bl.preparation_id:
            resa = ReservationStock.objects.filter(
                preparation_id=bl.preparation_id, produit_id=l.produit_id
            ).first()
        sortie(l.produit_id, l.quantite_livree, T.SORTIE_LIVRAISON,
               livraison=bl, reference=bl.num_bl, reservation=resa)
    if bl.preparation_id:   # reliquat éventuel de réservation
        liberer_preparation(bl.preparation)


def retour_avoir(avoir, emplacement):
    """Remet en stock les quantités retournées d'un avoir (une seule fois)."""
    avoir = type(avoir).objects.select_for_update().get(pk=avoir.pk)
    if MouvementStock.objects.filter(
        type_mouvement=T.ENTREE_RETOUR, reference=avoir.num_avoir
    ).exists():
        raise ValidationError({'detail': "Le retour en stock de cet avoir est déjà enregistré."})
    for l in avoir.lignes.all():
        entree(l.produit_id, l.quantite_retournee, emplacement, T.ENTREE_RETOUR,
               reference=avoir.num_avoir)


# ---------------------------------------------------------------- Inventaire
def demarrer_inventaire(inventaire):
    """Fige le théorique : une ligne par (emplacement, produit) du magasin."""
    from django.db import transaction

    from .models import Inventaire, LigneInventaire
    with transaction.atomic():
        inv = Inventaire.objects.select_for_update().get(pk=inventaire.pk)
        if inv.statut != Inventaire.Statut.BROUILLON:
            raise ValidationError({'detail': "Seul un inventaire BROUILLON peut démarrer."})
        lignes = list(
            LigneStock.objects.select_for_update().filter(
                emplacement__magasin_id=inv.magasin_id
            ).select_related('emplacement', 'produit')
        )
        LigneInventaire.objects.bulk_create([
            LigneInventaire(
                inventaire=inv, emplacement=l.emplacement, produit=l.produit,
                quantite_theorique=l.quantite_physique,
            )
            for l in lignes
        ])
        inv.statut = Inventaire.Statut.EN_COURS
        inv.save(update_fields=['statut'])
    return inv


def valider_inventaire(inventaire):
    """Passe les ajustements (écarts) puis fige l'inventaire. Irréversible."""
    from django.db import transaction

    from .models import Inventaire, LigneInventaire
    with transaction.atomic():
        inv = Inventaire.objects.select_for_update().get(pk=inventaire.pk)
        if inv.statut != Inventaire.Statut.EN_COURS:
            raise ValidationError({'detail': "Seul un inventaire EN_COURS peut être validé."})
        lignes = list(
            LigneInventaire.objects.select_for_update().filter(
                inventaire=inv
            ).select_related('emplacement', 'produit')
        )
        manquantes = [
            f"{l.produit.code_produit} @ {l.emplacement}"
            for l in lignes if l.quantite_comptee is None
        ]
        if manquantes:
            raise ValidationError({
                'detail': "Comptage incomplet.",
                'manquantes': manquantes,
            })
        for l in lignes:
            ecart = l.quantite_comptee - l.quantite_theorique
            if ecart > 0:
                entree(l.produit_id, ecart, l.emplacement,
                       T.ENTREE_AJUSTEMENT, reference=inv.code_inventaire)
            elif ecart < 0:
                sortie(l.produit_id, -ecart, T.SORTIE_AJUSTEMENT,
                       emplacement=l.emplacement, reference=inv.code_inventaire)
        inv.statut = Inventaire.Statut.VALIDE
        inv.date_fin = timezone.now()
        inv.save(update_fields=['statut', 'date_fin'])
    return inv