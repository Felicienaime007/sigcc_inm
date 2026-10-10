from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

from apps.commercial.models import Facture

MONTANT = {'max_digits': 15, 'decimal_places': 2}

# Carnet national du SFC : 50 feuilles x 5 volets = 250 volets
NB_FEUILLES = 50
VOLETS = ('A', 'B', 'C', 'D', 'E')
NB_VOLETS_CARNET = NB_FEUILLES * len(VOLETS)


# Coupures officielles de l'Ariary pour le comptage physique de caisse
COUPURES = (20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10)


class Caisse(models.Model):
    id_caisse = models.AutoField(primary_key=True)
    code_caisse = models.CharField(max_length=20, unique=True)
    libelle_caisse = models.CharField(max_length=100)
    # Modifié uniquement par apps/tresorerie/services.py et les serializers de caisse
    solde_actuel = models.DecimalField(**MONTANT, default=0)

    class Meta:
        db_table = 'caisse'
        ordering = ['code_caisse']

    def __str__(self):
        return f'{self.code_caisse} - {self.libelle_caisse}'


class Reglement(models.Model):
    class Mode(models.TextChoices):
        ESPECES = 'ESPECES', 'Espèces'
        CHEQUE = 'CHEQUE', 'Chèque'
        VIREMENT_TRESOR = 'VIREMENT_TRESOR', 'Virement du Trésor'

    class Statut(models.TextChoices):
        ACTIF = 'ACTIF', 'Actif'
        ANNULE = 'ANNULE', 'Annulé (contre-passé)'

    id_reglement = models.AutoField(primary_key=True)
    mode_reglement = models.CharField(max_length=30, choices=Mode.choices)
    date_reglement = models.DateTimeField(default=timezone.now)
    montant_regle = models.DecimalField(**MONTANT, validators=[MinValueValidator(Decimal('0.01'))])
    num_virement_tresor = models.CharField(max_length=100, unique=True, null=True, blank=True)
    facture = models.ForeignKey(
        Facture, on_delete=models.PROTECT,
        db_column='id_facture', related_name='reglements',
    )
    # Correction d'une saisie erronée : on ne supprime jamais, on contre-passe.
    statut = models.CharField(
        max_length=30, choices=Statut.choices, default=Statut.ACTIF
    )
    motif_annulation = models.TextField(null=True, blank=True)
    date_annulation = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'reglement'
        ordering = ['-date_reglement', '-id_reglement']
        indexes = [models.Index(fields=['mode_reglement'], name='idx_reglement_mode')]

    def __str__(self):
        return f'Règlement {self.montant_regle} ({self.mode_reglement})'


class LivreQuittance(models.Model):
    class Statut(models.TextChoices):
        EN_COURS = 'EN_COURS', 'En cours'
        EPUISE = 'EPUISE', 'Épuisé'

    id_livre = models.AutoField(primary_key=True)
    numero_livre = models.CharField(max_length=50, unique=True)
    annee_ouverture = models.PositiveIntegerField(
        validators=[MinValueValidator(2000), MaxValueValidator(2100)]
    )
    statut_livre = models.CharField(
        max_length=30, choices=Statut.choices, default=Statut.EN_COURS
    )

    class Meta:
        db_table = 'livre_quittance'
        ordering = ['-annee_ouverture', 'numero_livre']

    def __str__(self):
        return self.numero_livre


class Quittance(models.Model):
    """Un volet physique du carnet : (livre, feuille, volet) est unique (RG-15)."""
    class Volet(models.TextChoices):
        A = 'A'
        B = 'B'
        C = 'C'
        D = 'D'
        E = 'E'

    class Statut(models.TextChoices):
        EMISE = 'EMISE', 'Émise'
        ANNULEE = 'ANNULEE', 'Annulée (contre-passée)'

    id_quittance = models.AutoField(primary_key=True)
    num_feuille = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(NB_FEUILLES)]
    )
    attribut_volet = models.CharField(max_length=1, choices=Volet.choices)
    date_emission = models.DateTimeField(default=timezone.now)
    # Contre-passation du règlement : la quittance physique reste tracée mais
    # marquée ANNULEE (le volet n'est jamais réutilisable).
    statut = models.CharField(
        max_length=30, choices=Statut.choices, default=Statut.EMISE
    )
    livre = models.ForeignKey(
        LivreQuittance, on_delete=models.PROTECT,
        db_column='id_livre', related_name='quittances',
    )
    reglement = models.OneToOneField(
        Reglement, on_delete=models.PROTECT, null=True, blank=True,
        db_column='id_reglement', related_name='quittance',
    )
    caisse = models.ForeignKey(
        Caisse, on_delete=models.PROTECT,
        db_column='id_caisse', related_name='quittances',
    )

    class Meta:
        db_table = 'quittance'
        ordering = ['-date_emission', '-id_quittance']
        constraints = [
            models.UniqueConstraint(
                fields=['livre', 'num_feuille', 'attribut_volet'],
                name='uk_quittance_matrice',
            )
        ]

    def __str__(self):
        return f'{self.livre.numero_livre}/{self.num_feuille}{self.attribut_volet}'


class LivreCaisse(models.Model):
    class Type(models.TextChoices):
        ENTREE = 'ENTREE', 'Entrée'
        SORTIE = 'SORTIE', 'Sortie'

    id_livre_caisse = models.AutoField(primary_key=True)
    date_operation = models.DateTimeField(default=timezone.now)
    type_operation = models.CharField(max_length=30, choices=Type.choices)
    montant_op = models.DecimalField(**MONTANT, validators=[MinValueValidator(Decimal('0.01'))])
    caisse = models.ForeignKey(
        Caisse, on_delete=models.PROTECT,
        db_column='id_caisse', related_name='ecritures',
    )
    # Ajouts par rapport au MLD
    reglement = models.ForeignKey(
        Reglement, on_delete=models.PROTECT, null=True, blank=True,
        db_column='id_reglement', related_name='ecritures',
    )
    reference = models.CharField(max_length=100, null=True, blank=True)

    class Meta:
        db_table = 'livre_caisse'
        ordering = ['-date_operation', '-id_livre_caisse']
        indexes = [models.Index(fields=['caisse', 'date_operation'], name='idx_livrecaisse_date')]

    def __str__(self):
        return f'{self.type_operation} {self.montant_op}'


class ArreteCaisse(models.Model):
    """Arrêté de caisse journalier : fige la journée, constate comptage et écart."""

    class Statut(models.TextChoices):
        BROUILLON = 'BROUILLON', 'Brouillon'
        VALIDE = 'VALIDE', 'Validé'

    id_arrete = models.AutoField(primary_key=True)
    caisse = models.ForeignKey(
        Caisse, on_delete=models.PROTECT,
        db_column='id_caisse', related_name='arretes',
    )
    date_arrete = models.DateField(default=timezone.localdate)
    # Snapshot au moment de la validation
    total_entrees = models.DecimalField(**MONTANT, default=0)
    total_sorties = models.DecimalField(**MONTANT, default=0)
    solde_theorique = models.DecimalField(**MONTANT, default=0)
    montant_compte = models.DecimalField(**MONTANT, default=0)
    ecart = models.DecimalField(**MONTANT, default=0)
    # Détail du comptage (billets/pièces) en JSON texte : {"10000": 12, ...}
    detail_billets = models.TextField(null=True, blank=True)
    statut = models.CharField(
        max_length=30, choices=Statut.choices, default=Statut.BROUILLON
    )
    date_validation = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'arrete_caisse'
        ordering = ['-date_arrete', '-id_arrete']
        constraints = [
            models.UniqueConstraint(
                fields=['caisse', 'date_arrete'], name='uk_arrete_caisse_date'
            )
        ]

    def __str__(self):
        return f'Arrêté {self.caisse.code_caisse} {self.date_arrete} ({self.statut})'


class RemiseBanque(models.Model):
    """Remise en banque des espèces/chèques de la caisse (bordereau traçable)."""

    class Statut(models.TextChoices):
        PREPAREE = 'PREPAREE', 'Préparée'
        REMISE = 'REMISE', 'Remise en banque'

    id_remise = models.AutoField(primary_key=True)
    caisse = models.ForeignKey(
        Caisse, on_delete=models.PROTECT,
        db_column='id_caisse', related_name='remises',
    )
    date_remise = models.DateTimeField(default=timezone.now)
    montant = models.DecimalField(**MONTANT, validators=[MinValueValidator(Decimal('0.01'))])
    reference_bordereau = models.CharField(max_length=100, unique=True)
    # Arrêté de caisse associé (optionnel) : la remise solde la journée comptée.
    arrete = models.ForeignKey(
        ArreteCaisse, on_delete=models.SET_NULL, null=True, blank=True,
        db_column='id_arrete', related_name='remises',
    )
    # ESPECES et/ou CHEQUE, séparés par virgule
    modes = models.CharField(max_length=50, default='ESPECES')
    statut = models.CharField(
        max_length=30, choices=Statut.choices, default=Statut.PREPAREE
    )
    date_statut = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'remise_banque'
        ordering = ['-date_remise', '-id_remise']

    def __str__(self):
        return f'Remise {self.reference_bordereau} ({self.montant} Ar)'