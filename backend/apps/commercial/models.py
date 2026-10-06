from datetime import timedelta
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone
from apps.budget.models import EngagementBudget
from apps.clients.models import Client
from apps.produits.models import ProduitFini
from django.core.exceptions import ValidationError as DjangoValidationError


QTE = {'validators': [MinValueValidator(1)]}
PRIX = {'max_digits': 15, 'decimal_places': 2, 'validators': [MinValueValidator(0)]}


# ---------------------------------------------------------------- Planification
class PlanificationBesoin(models.Model):
    id_planification = models.AutoField(primary_key=True)
    date_planif = models.DateField(default=timezone.localdate)
    periode_cible = models.CharField(max_length=50)       # ex : "2026-T3"
    client = models.ForeignKey(
        Client, on_delete=models.PROTECT,
        db_column='id_client', related_name='planifications',
    )

    class Meta:
        db_table = 'planification_besoin'
        ordering = ['-date_planif', '-id_planification']
        constraints = [
            models.UniqueConstraint(
                fields=['client', 'periode_cible'], name='uk_planif_client_periode'
            )
        ]

    def __str__(self):
        return f'Planification {self.periode_cible} - {self.client.nom_client}'


class LignePlanification(models.Model):
    planification = models.ForeignKey(
        PlanificationBesoin, on_delete=models.CASCADE,
        db_column='id_planification', related_name='lignes',
    )
    produit = models.ForeignKey(
        ProduitFini, on_delete=models.PROTECT, db_column='id_produit',
        related_name='lignes_planification',
    )
    quantite_estimee = models.PositiveIntegerField(**QTE)

    class Meta:
        db_table = 'ligne_planification'
        constraints = [
            models.UniqueConstraint(
                fields=['planification', 'produit'], name='uk_lignepl_plan_prod'
            )
        ]


# ------------------------------------------------------------------------ Devis
class DevisProforma(models.Model):
    id_devis = models.AutoField(primary_key=True)
    num_devis = models.CharField(max_length=50, unique=True)
    date_devis = models.DateField(default=timezone.localdate)
    validite_jours = models.PositiveIntegerField(default=30)
    client = models.ForeignKey(
        Client, on_delete=models.PROTECT,
        db_column='id_client', related_name='devis',
    )

    class Meta:
        db_table = 'devis_proforma'
        ordering = ['-date_devis', '-id_devis']

    @property
    def date_expiration(self):
        return self.date_devis + timedelta(days=self.validite_jours)

    @property
    def est_expire(self):
        return self.date_expiration < timezone.localdate()

    def __str__(self):
        return self.num_devis


class LigneDevis(models.Model):
    devis = models.ForeignKey(
        DevisProforma, on_delete=models.CASCADE,
        db_column='id_devis', related_name='lignes',
    )
    produit = models.ForeignKey(
        ProduitFini, on_delete=models.PROTECT, db_column='id_produit',
        related_name='lignes_devis',
    )
    quantite = models.PositiveIntegerField(**QTE)
    prix_unitaire_devis = models.DecimalField(**PRIX)

    class Meta:
        db_table = 'ligne_devis'
        constraints = [
            models.UniqueConstraint(
                fields=['devis', 'produit'], name='uk_lignedev_dev_prod'
            )
        ]


# --------------------------------------------------------------------- Commande
class Commande(models.Model):
    class Statut(models.TextChoices):
        BROUILLON = 'BROUILLON', 'Brouillon'
        VALIDEE = 'VALIDEE', 'Validée'
        EN_PREPARATION = 'EN_PREPARATION', 'En préparation'   # posé par la partie 2
        LIVREE = 'LIVREE', 'Livrée'                           # posé par la partie 2
        FACTUREE = 'FACTUREE', 'Facturée'                     # posé par la partie 2
        ANNULEE = 'ANNULEE', 'Annulée'

    id_commande = models.AutoField(primary_key=True)
    num_commande = models.CharField(max_length=50, unique=True)
    date_commande = models.DateField(default=timezone.localdate)
    statut_commande = models.CharField(
        max_length=30, choices=Statut.choices, default=Statut.BROUILLON
    )
    client = models.ForeignKey(
        Client, on_delete=models.PROTECT,
        db_column='id_client', related_name='commandes',
    )
    devis = models.OneToOneField(
        DevisProforma, on_delete=models.PROTECT, null=True, blank=True,
        db_column='id_devis', related_name='commande',
    )
    engagement = models.OneToOneField(
        EngagementBudget, on_delete=models.PROTECT, null=True, blank=True,
        db_column='id_engagement', related_name='commande',
    )

    class Meta:
        db_table = 'commande'
        ordering = ['-date_commande', '-id_commande']
        indexes = [models.Index(fields=['statut_commande'], name='idx_commande_statut')]

    def __str__(self):
        return self.num_commande


class LigneCommande(models.Model):
    commande = models.ForeignKey(
        Commande, on_delete=models.CASCADE,
        db_column='id_commande', related_name='lignes',
    )
    produit = models.ForeignKey(
        ProduitFini, on_delete=models.PROTECT, db_column='id_produit',
        related_name='lignes_commande',
    )
    quantite_commandee = models.PositiveIntegerField(**QTE)
    prix_unitaire_facture = models.DecimalField(**PRIX)

    class Meta:
        db_table = 'ligne_commande'
        constraints = [
            models.UniqueConstraint(
                fields=['commande', 'produit'], name='uk_lignecmd_cmd_prod'
            )
        ]

# ------------------------------------------------------------------ Préparation
class PreparationCommande(models.Model):
    class Statut(models.TextChoices):
        EN_COURS = 'EN_COURS', 'En cours'
        PRETE = 'PRETE', 'Prête'
        LIVREE = 'LIVREE', 'Livrée'

    id_preparation = models.AutoField(primary_key=True)
    date_prepa = models.DateTimeField(default=timezone.now)
    statut_prepa = models.CharField(
        max_length=30, choices=Statut.choices, default=Statut.EN_COURS
    )
    commande = models.OneToOneField(
        Commande, on_delete=models.PROTECT,
        db_column='id_commande', related_name='preparation',
    )

    class Meta:
        db_table = 'preparation_commande'
        ordering = ['-date_prepa', '-id_preparation']

    def __str__(self):
        return f'Préparation {self.commande.num_commande}'


class LignePreparation(models.Model):
    preparation = models.ForeignKey(
        PreparationCommande, on_delete=models.CASCADE,
        db_column='id_preparation', related_name='lignes',
    )
    produit = models.ForeignKey(
        ProduitFini, on_delete=models.PROTECT, db_column='id_produit',
        related_name='lignes_preparation',
    )
    quantite_preparee = models.PositiveIntegerField(**QTE)

    class Meta:
        db_table = 'ligne_preparation'
        constraints = [
            models.UniqueConstraint(
                fields=['preparation', 'produit'], name='uk_lignepre_prep_prod'
            )
        ]


# ---------------------------------------------------------------------- Facture
class Facture(models.Model):
    class TypeFacturation(models.TextChoices):
        QUITTANCE = 'QUITTANCE', 'Quittance'
        VIREMENT_TRESOR = 'VIREMENT_TRESOR', 'Virement du Trésor'

    class StatutPaiement(models.TextChoices):
        NON_PAYEE = 'NON_PAYEE', 'Non payée'
        PARTIELLE = 'PARTIELLE', 'Partiellement payée'
        PAYEE = 'PAYEE', 'Payée'

    id_facture = models.AutoField(primary_key=True)
    num_facture = models.CharField(max_length=50, unique=True)
    date_facture = models.DateTimeField(default=timezone.now)
    montant_ht = models.DecimalField(**PRIX)
    tva = models.DecimalField(**PRIX)
    type_facturation = models.CharField(max_length=30, choices=TypeFacturation.choices)
    # Mis à jour par le module trésorerie (règlements)
    statut_paiement = models.CharField(
        max_length=30, choices=StatutPaiement.choices, default=StatutPaiement.NON_PAYEE
    )
    commande = models.OneToOneField(
        Commande, on_delete=models.PROTECT, null=True, blank=True,
        db_column='id_commande', related_name='facture',
    )
    client = models.ForeignKey(       # vente comptoir uniquement
        Client, on_delete=models.PROTECT, null=True, blank=True,
        db_column='id_client', related_name='factures_directes',
    )

    class Meta:
        db_table = 'facture'
        ordering = ['-date_facture', '-id_facture']
        indexes = [models.Index(fields=['statut_paiement'], name='idx_facture_statut')]

    @property
    def client_facture(self):
        return self.commande.client if self.commande_id else self.client

    @property
    def montant_ttc(self):
        return self.montant_ht + self.tva

    def clean(self):
        # Contrainte XOR du MLD : soit une commande, soit un client, jamais les deux
        if (self.commande_id is None) == (self.client_id is None):
            raise DjangoValidationError(
                "Une facture est liée soit à une commande, soit à un client "
                "(vente comptoir), jamais aux deux."
            )

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.num_facture


class LigneFacture(models.Model):
    facture = models.ForeignKey(
        Facture, on_delete=models.CASCADE,
        db_column='id_facture', related_name='lignes',
    )
    produit = models.ForeignKey(
        ProduitFini, on_delete=models.PROTECT, db_column='id_produit',
        related_name='lignes_facture',
    )
    quantite_facturee = models.PositiveIntegerField(**QTE)
    prix_unitaire = models.DecimalField(**PRIX)      # ajout par rapport au MLD

    class Meta:
        db_table = 'ligne_facture'
        constraints = [
            models.UniqueConstraint(
                fields=['facture', 'produit'], name='uk_lignefac_fac_prod'
            )
        ]


# ------------------------------------------------------------------- Livraison
class BonLivraison(models.Model):
    id_livraison = models.AutoField(primary_key=True)
    num_bl = models.CharField(max_length=50, unique=True)
    date_livraison = models.DateTimeField(default=timezone.now)
    preparation = models.OneToOneField(
        PreparationCommande, on_delete=models.PROTECT, null=True, blank=True,
        db_column='id_preparation', related_name='bon_livraison',
    )
    facture = models.OneToOneField(       # livraison comptoir
        Facture, on_delete=models.PROTECT, null=True, blank=True,
        db_column='id_facture', related_name='bon_livraison',
    )

    class Meta:
        db_table = 'bon_livraison'
        ordering = ['-date_livraison', '-id_livraison']

    def __str__(self):
        return self.num_bl


class LigneLivraison(models.Model):
    livraison = models.ForeignKey(
        BonLivraison, on_delete=models.CASCADE,
        db_column='id_livraison', related_name='lignes',
    )
    produit = models.ForeignKey(
        ProduitFini, on_delete=models.PROTECT, db_column='id_produit',
        related_name='lignes_livraison',
    )
    quantite_livree = models.PositiveIntegerField(**QTE)

    class Meta:
        db_table = 'ligne_livraison'
        constraints = [
            models.UniqueConstraint(
                fields=['livraison', 'produit'], name='uk_ligneliv_liv_prod'
            )
        ]


# ------------------------------------------------------------------------ Avoir
class Avoir(models.Model):
    id_avoir = models.AutoField(primary_key=True)
    num_avoir = models.CharField(max_length=50, unique=True)
    date_avoir = models.DateTimeField(default=timezone.now)
    motif = models.TextField()
    facture = models.ForeignKey(
        Facture, on_delete=models.PROTECT,
        db_column='id_facture', related_name='avoirs',
    )

    class Meta:
        db_table = 'avoir'
        ordering = ['-date_avoir', '-id_avoir']

    def __str__(self):
        return self.num_avoir


class LigneAvoir(models.Model):
    avoir = models.ForeignKey(
        Avoir, on_delete=models.CASCADE,
        db_column='id_avoir', related_name='lignes',
    )
    produit = models.ForeignKey(
        ProduitFini, on_delete=models.PROTECT, db_column='id_produit',
        related_name='lignes_avoir',
    )
    quantite_retournee = models.PositiveIntegerField(**QTE)
    montant_avoir = models.DecimalField(**PRIX)

    class Meta:
        db_table = 'ligne_avoir'
        constraints = [
            models.UniqueConstraint(
                fields=['avoir', 'produit'], name='uk_ligneavo_avo_prod'
            )
        ]