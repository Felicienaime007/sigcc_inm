import json
from datetime import datetime, timezone as dt_timezone
from decimal import Decimal

from django.apps import apps
from django.core.serializers.json import DjangoJSONEncoder
from django.db.models import DecimalField
from django.db.models.signals import post_delete, post_save, pre_save

from .context import acteur
from .models import AuditLog
from .registry import AUDITED, CHAMPS_EXCLUS


# ---------------------------------------------------------------- Instantanés
def _normaliser(champ, valeur):
    """Rend les valeurs comparables entre l'instance en mémoire et la ligne en base."""
    if valeur is None:
        return None
    if isinstance(champ, DecimalField) and champ.decimal_places is not None:
        return Decimal(valeur).quantize(Decimal(1).scaleb(-champ.decimal_places))
    if isinstance(valeur, datetime) and valeur.tzinfo is not None:
        return valeur.astimezone(dt_timezone.utc)
    return valeur


def _champs(modele, restreint=None):
    return [
        f for f in modele._meta.concrete_fields
        if f.name not in CHAMPS_EXCLUS and f.attname not in CHAMPS_EXCLUS
        and (restreint is None or f.name in restreint)
    ]


def _instantane(instance, restreint=None):
    """{attname: valeur} à partir d'un objet (champs différés ignorés)."""
    differes = instance.get_deferred_fields()
    return {
        f.attname: _normaliser(f, f.value_from_object(instance))
        for f in _champs(type(instance), restreint)
        if f.attname not in differes
    }


def _instantane_base(modele, pk, restreint=None):
    ligne = modele._base_manager.filter(pk=pk).first()
    return _instantane(ligne, restreint) if ligne is not None else {}


def _json(d):
    return json.dumps(d, cls=DjangoJSONEncoder, ensure_ascii=False) if d is not None else None


def _ecrire(operation, instance, avant, apres):
    id_user, identifiant, ip = acteur()
    registre = AUDITED[f'{instance._meta.app_label}.{instance._meta.object_name}']
    AuditLog.objects.create(
        id_utilisateur=id_user, identifiant_utilisateur=identifiant, adresse_ip=ip,
        operation=operation, table_nom=instance._meta.db_table,
        id_objet=str(instance.pk),
        reference=(str(getattr(instance, registre, '') or '') or None) if registre else None,
        ancienne_valeur=_json(avant), nouvelle_valeur=_json(apres),
    )


# -------------------------------------------------------------------- Signaux
def _pre_save(sender, instance, raw=False, update_fields=None, **kwargs):
    if raw:
        return
    instance._audit_avant = None
    if instance.pk is not None and not instance._state.adding:
        instance._audit_avant = _instantane_base(sender, instance.pk, update_fields)


def _post_save(sender, instance, created, raw=False, update_fields=None, **kwargs):
    if raw:
        return
    apres = _instantane(instance, update_fields)
    if created:
        _ecrire(AuditLog.Operation.CREATE, instance, None, apres)
        return
    avant = getattr(instance, '_audit_avant', None) or {}
    modifies = [k for k in apres if avant.get(k) != apres[k]]
    if not modifies:
        return      # sauvegarde sans changement : rien à tracer
    _ecrire(
        AuditLog.Operation.UPDATE, instance,
        {k: avant.get(k) for k in modifies}, {k: apres[k] for k in modifies},
    )


def _post_delete(sender, instance, **kwargs):
    _ecrire(AuditLog.Operation.DELETE, instance, _instantane(instance), None)


def connecter():
    for label in AUDITED:
        modele = apps.get_model(label)
        uid = f'audit_{label}'
        pre_save.connect(_pre_save, sender=modele, dispatch_uid=f'{uid}_pre', weak=False)
        post_save.connect(_post_save, sender=modele, dispatch_uid=f'{uid}_post', weak=False)
        post_delete.connect(_post_delete, sender=modele, dispatch_uid=f'{uid}_del', weak=False)