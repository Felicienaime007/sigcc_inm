import logging
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from apps.users.models import Utilisateur

from .catalogue import TYPES
from .models import Notification, TypeMasque

log = logging.getLogger(__name__)


def ar(valeur):
    """Montant lisible dans un message : « 1 340 000 Ar »."""
    return f"{int(valeur):,}".replace(',', '\u00a0') + '\u00a0Ar'


def plus_tard(fonction, *args):
    """Exécute après la validation de la transaction ; une erreur ne casse jamais l'opération métier."""
    def run():
        try:
            fonction(*args)
        except Exception:
            log.exception("Notification non créée")
    transaction.on_commit(run)


def notifier(
    type_code, titre, message='', lien=None, roles=None, utilisateurs=None,
    niveau=None, cle=None, fenetre=None, exclure=None,
):
    """
    Crée une notification pour chaque destinataire.
    roles / utilisateurs (identifiants) : à défaut, les rôles par défaut du type.
    cle + fenetre : pas de doublon pour la même clé dans la fenêtre de temps.
    exclure : identifiant d'un utilisateur à ne pas notifier (l'auteur de l'action).
    Retourne le nombre de notifications créées.
    """
    definition = TYPES[type_code]
    if utilisateurs is not None:
        ids = set(utilisateurs)
    else:
        roles = definition['roles'] if roles is None else roles
        ids = set(
            Utilisateur.objects.filter(statut_compte='ACTIF', roles__libelle_role__in=roles)
            .values_list('pk', flat=True)
        )
    if exclure:
        ids.discard(exclure)
    if not ids:
        return 0

    if not definition.get('obligatoire'):
        ids -= set(TypeMasque.objects.filter(type_notif=type_code, utilisateur_id__in=ids)
                   .values_list('utilisateur_id', flat=True))
    if cle and fenetre:
        ids -= set(Notification.objects.filter(
            cle=cle, utilisateur_id__in=ids, cree_le__gte=timezone.now() - fenetre,
        ).values_list('utilisateur_id', flat=True))
    if not ids:
        return 0

    Notification.objects.bulk_create([
        Notification(
            utilisateur_id=uid, type_notif=type_code, niveau=niveau or definition['niveau'],
            titre=titre[:150], message=(message or '')[:500] or None, lien=lien, cle=cle,
        )
        for uid in ids
    ])
    return len(ids)


def jours(n):
    return timedelta(days=n)