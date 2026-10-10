from django.conf import settings
from django.db import models
from django.utils import timezone


class Notification(models.Model):
    class Niveau(models.TextChoices):
        INFO = 'INFO', 'Information'
        ATTENTION = 'ATTENTION', 'Attention'
        URGENT = 'URGENT', 'Urgent'

    id_notification = models.AutoField(primary_key=True)
    utilisateur = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        db_column='id_utilisateur', related_name='notifications',
    )
    type_notif = models.CharField(max_length=50)
    niveau = models.CharField(max_length=10, choices=Niveau.choices, default=Niveau.INFO)
    titre = models.CharField(max_length=150)
    message = models.CharField(max_length=500, null=True, blank=True)
    lien = models.CharField(max_length=200, null=True, blank=True)    # chemin interne : /commercial/factures
    cle = models.CharField(max_length=120, null=True, blank=True)     # anti-doublon des alertes périodiques
    cree_le = models.DateTimeField(default=timezone.now)
    lu_le = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'notification'
        ordering = ['-cree_le', '-id_notification']
        indexes = [
            models.Index(fields=['utilisateur', 'lu_le'], name='idx_notif_user_lu'),
            models.Index(fields=['cle'], name='idx_notif_cle'),
        ]

    def __str__(self):
        return f'{self.titre} → {self.utilisateur_id}'


class TypeMasque(models.Model):
    """Un type de notification que l'utilisateur a désactivé."""
    utilisateur = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        db_column='id_utilisateur', related_name='types_masques',
    )
    type_notif = models.CharField(max_length=50)

    class Meta:
        db_table = 'notification_masque'
        constraints = [
            models.UniqueConstraint(fields=['utilisateur', 'type_notif'], name='uk_notif_masque')
        ]