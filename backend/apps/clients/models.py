import re

from django.core.exceptions import ValidationError
from django.db import models
from apps.territoire.models import Fokontany


class Organisme(models.Model):
    """Institution de tutelle (Ministère, CTD centrale...). MLD Bloc 1."""

    id_organisme = models.AutoField(primary_key=True)
    nom_organisme = models.CharField(max_length=255)
    code_institutionnel = models.CharField(max_length=50, unique=True)

    class Meta:
        db_table = 'organisme'
        ordering = ['nom_organisme']

    def __str__(self):
        return self.nom_organisme


class Client(models.Model):
    """Compte client / SOA. MLD Bloc 2 + RG-01/RG-02 (chap. V).

    Précision métier : ORGANISME n'est PAS un type client, c'est l'entité
    parente indépendante (ex. Ministère de l'Éducation Nationale). Les clients
    MINISTERE/CTD sont des SOA rattachés à un organisme via `organisme`
    (c'est le SOA qui commande, pas l'organisme lui-même).
    Les SIMPLE sont saisis au comptoir par la réception.
    """

    class TypeClient(models.TextChoices):
        MINISTERE = 'MINISTERE', 'Ministère (SOA rattaché à un organisme)'
        CTD = 'CTD', 'Collectivité Territoriale Décentralisée (SOA rattaché)'
        PRIVE = 'PRIVE', 'Entreprise privée'
        SIMPLE = 'SIMPLE', 'Client simple (comptoir, géré par la réception)'

    TYPES_PUBLICS = {TypeClient.MINISTERE, TypeClient.CTD}
    TYPES_SANS_SOA = {TypeClient.PRIVE, TypeClient.SIMPLE}

    id_client = models.AutoField(primary_key=True)
    code_soa = models.CharField(max_length=50, null=True, blank=True, unique=True)
    nom_client = models.CharField(max_length=150)
    type_client = models.CharField(max_length=20, choices=TypeClient.choices)
    adresse = models.TextField(null=True, blank=True)
    telephone = models.CharField(max_length=30, null=True, blank=True)
    cin_ou_nif = models.CharField(max_length=50, null=True, blank=True, unique=True)
    fokontany = models.ForeignKey(
        Fokontany, on_delete=models.PROTECT, null=True, blank=True,
        db_column='id_fokontany', related_name='clients',
    )   # SOA uniquement
    ville = models.CharField(max_length=100, null=True, blank=True)   # PRIVE et SIMPLE uniquement
    organisme = models.ForeignKey(
        Organisme, on_delete=models.PROTECT,
        db_column='id_organisme', related_name='clients',
        null=True, blank=True,
    )

    class Meta:
        db_table = 'client'
        ordering = ['nom_client']
        constraints = [
            models.CheckConstraint(
                condition=models.Q(
                    type_client__in=[
                        'MINISTERE', 'CTD', 'PRIVE', 'SIMPLE'
                    ]
                ),
                name='ck_client_type',
            ),
        ]

    def __str__(self):
        return f'{self.nom_client} ({self.type_client})'

    def clean(self):
        super().clean()
        errors = {}
        # RG-02 : SOA obligatoire (5 chiffres) pour MINISTERE/CTD, NULL pour PRIVE/SIMPLE
        if self.type_client in (self.TypeClient.MINISTERE, self.TypeClient.CTD):
            if not self.code_soa:
                errors['code_soa'] = (
                    'Le code SOA est obligatoire pour un client MINISTERE/CTD.'
                )
            elif not re.fullmatch(r'\d{5}', self.code_soa):
                errors['code_soa'] = 'Le code SOA doit comporter exactement 5 chiffres.'
            # Rattachement obligatoire : le SOA commande au nom de son organisme
            # (ex. un SOA du Ministère de l'Éducation Nationale, pas le MEN lui-même)
            if not self.organisme_id:
                errors['organisme'] = (
                    'Un client MINISTERE/CTD doit être rattaché à son organisme '
                    '(ex. le SOA commande, pas le ministère lui-même).'
                )
        elif self.type_client in (self.TypeClient.PRIVE, self.TypeClient.SIMPLE):
            if self.code_soa:
                errors['code_soa'] = (
                    'Le code SOA doit être NULL pour un client PRIVE/SIMPLE.'
                )
        # MCD : lien organisme nul pour le privé / passager (SIMPLE géré par réception)
        if (
            self.type_client in (self.TypeClient.PRIVE, self.TypeClient.SIMPLE)
            and self.organisme_id
        ):
            errors['organisme'] = (
                "Un client PRIVE/SIMPLE ne peut pas être rattaché à un organisme."
            )
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class SolvabiliteClient(models.Model):
    """Fiche de risque, uniquement pour les clients PRIVE. MLD Bloc 2 + RG-03."""

    BLOCAGE_ACTIF = 0
    BLOCAGE_BLOQUE = 1
    CHOIX_BLOCAGE = ((BLOCAGE_ACTIF, 'Actif'), (BLOCAGE_BLOQUE, 'Bloqué'))

    id_solvabilite = models.AutoField(primary_key=True)
    client = models.OneToOneField(
        Client, on_delete=models.CASCADE,
        db_column='id_client', related_name='solvabilite',
    )
    score_credit = models.DecimalField(max_digits=5, decimal_places=2)
    plafond_encours = models.DecimalField(max_digits=15, decimal_places=2)
    # NUMBER(1) 0/1 — BOOLEAN banni sur Oracle (§9.2)
    statut_blocage = models.SmallIntegerField(
        choices=CHOIX_BLOCAGE, default=BLOCAGE_ACTIF
    )

    class Meta:
        db_table = 'solvabilite_client'
        constraints = [
            models.CheckConstraint(
                condition=models.Q(statut_blocage__in=[0, 1]),
                name='ck_solvabilite_blocage',
            ),
        ]

    def __str__(self):
        return f'Solvabilité {self.client.nom_client}'

    def clean(self):
        super().clean()
        if (
            self.client_id
            and self.client.type_client != Client.TypeClient.PRIVE
        ):
            raise ValidationError({
                'client': 'La solvabilité ne concerne que les clients de type PRIVE.',
            })

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)
