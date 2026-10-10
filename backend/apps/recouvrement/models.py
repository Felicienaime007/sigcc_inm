from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

from apps.commercial.models import Facture


class Recouvrement(models.Model):
    class Statut(models.TextChoices):
        EN_COURS = 'EN_COURS', 'En cours (amiable)'
        REGLE = 'REGLE', 'Réglé'
        CONTENTIEUX = 'CONTENTIEUX', 'Contentieux'

    id_recouvrement = models.AutoField(primary_key=True)
    num_dossier = models.CharField(max_length=50, unique=True)
    date_relance = models.DateField(default=timezone.localdate)      # dernière relance
    niveau_relance = models.PositiveSmallIntegerField(
        default=1, validators=[MinValueValidator(1), MaxValueValidator(3)]
    )   # 1 = amiable ... 3 = contentieux
    statut_dossier = models.CharField(
        max_length=30, choices=Statut.choices, default=Statut.EN_COURS
    )

    class Meta:
        db_table = 'recouvrement'
        ordering = ['-date_relance', '-id_recouvrement']
        indexes = [models.Index(fields=['statut_dossier'], name='idx_recouv_statut')]

    def __str__(self):
        return self.num_dossier


class LigneRecouvrement(models.Model):
    recouvrement = models.ForeignKey(
        Recouvrement, on_delete=models.CASCADE,
        db_column='id_recouvrement', related_name='lignes',
    )
    facture = models.ForeignKey(
        Facture, on_delete=models.PROTECT,
        db_column='id_facture', related_name='lignes_recouvrement',
    )
    # Solde restant dû, mis à jour à chaque règlement ou par l'action « actualiser »
    montant_a_recouvrer = models.DecimalField(
        max_digits=15, decimal_places=2, validators=[MinValueValidator(0)]
    )

    class Meta:
        db_table = 'ligne_recouvrement'
        constraints = [
            models.UniqueConstraint(
                fields=['recouvrement', 'facture'], name='uk_lignerec_rec_fac'
            )
        ]

    def __str__(self):
        return f'{self.recouvrement_id} / {self.facture_id}'


class Relance(models.Model):
    """Chaque relance effectuée sur un dossier : qui, quand, niveau, canal, commentaire.

    L'ouverture du dossier crée la première entrée (niveau 1). Les actions
    `relancer` / `escalader` ajoutent une entrée au lieu d'écraser la date.
    """

    class Canal(models.TextChoices):
        TELEPHONE = 'TELEPHONE', 'Téléphone'
        EMAIL = 'EMAIL', 'E-mail'
        COURRIER = 'COURRIER', 'Courrier'
        VISITE = 'VISITE', 'Visite'
        SMS = 'SMS', 'SMS'
        AUTRE = 'AUTRE', 'Autre'

    class Nature(models.TextChoices):
        OUVERTURE = 'OUVERTURE', 'Ouverture du dossier'
        RELANCE = 'RELANCE', 'Relance au même niveau'
        ESCALADE = 'ESCALADE', 'Passage au niveau supérieur'

    id_relance = models.AutoField(primary_key=True)
    dossier = models.ForeignKey(
        Recouvrement, on_delete=models.CASCADE,
        db_column='id_recouvrement', related_name='relances',
    )
    auteur = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, db_column='id_utilisateur',
        related_name='relances_effectuees',
    )
    date_relance = models.DateTimeField(default=timezone.now)
    niveau = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(3)]
    )
    nature = models.CharField(max_length=30, choices=Nature.choices)
    canal = models.CharField(
        max_length=30, choices=Canal.choices, default=Canal.TELEPHONE
    )
    commentaire = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'relance'
        ordering = ['-date_relance', '-id_relance']
        indexes = [models.Index(fields=['dossier', 'date_relance'], name='idx_relance_dossier')]

    def __str__(self):
        return f'{self.dossier.num_dossier} · niveau {self.niveau} ({self.get_nature_display()})'