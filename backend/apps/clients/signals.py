"""Création automatique de la fiche de solvabilité des clients PRIVE.

Un client privé sans fiche ne peut valider aucune commande : plutôt que de
laisser un état intermédiaire à créer à la main, on crée la fiche dès le
client, avec des valeurs sûres (score 0, plafond 0, actif). Le comptable
renseigne ensuite le vrai score et le plafond via l'écran Solvabilité.
"""
from decimal import Decimal

from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Client, SolvabiliteClient


@receiver(post_save, sender=Client)
def creer_fiche_solvabilite(sender, instance, created, **kwargs):
    if not created or instance.type_client != Client.TypeClient.PRIVE:
        return
    SolvabiliteClient.objects.get_or_create(
        client=instance,
        defaults={
            'score_credit': Decimal('0'),
            'plafond_encours': Decimal('0'),
            'statut_blocage': SolvabiliteClient.BLOCAGE_ACTIF,
        },
    )
