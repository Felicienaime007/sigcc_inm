from django.core.validators import MinValueValidator
from django.db import models


class CategorieProduit(models.Model):
    id_categorie = models.AutoField(primary_key=True)
    libelle_categorie = models.CharField(max_length=100, unique=True)

    class Meta:
        db_table = 'categorie_produit'
        ordering = ['libelle_categorie']

    def __str__(self):
        return self.libelle_categorie


class ConfigSerieDocument(models.Model):
    """Compteur de numérotation d'un document imprimé en série."""
    id_config = models.AutoField(primary_key=True)
    dernier_numero_valide = models.PositiveIntegerField(default=0)
    prefixe_courant = models.CharField(max_length=10, null=True, blank=True)

    class Meta:
        db_table = 'config_serie_document'
        ordering = ['id_config']

    def __str__(self):
        return f'Série {self.prefixe_courant or ""} (dernier n° {self.dernier_numero_valide})'


class ProduitFini(models.Model):
    id_produit = models.AutoField(primary_key=True)
    code_produit = models.CharField(max_length=50, unique=True)
    designation = models.CharField(max_length=150)
    prix_tarif = models.DecimalField(
        max_digits=15, decimal_places=2, validators=[MinValueValidator(0)]
    )
    categorie = models.ForeignKey(
        CategorieProduit, on_delete=models.PROTECT,
        db_column='id_categorie', related_name='produits',
    )
    config = models.OneToOneField(
        ConfigSerieDocument, on_delete=models.PROTECT, null=True, blank=True,
        db_column='id_config', related_name='produit',
    )

    class Meta:
        db_table = 'produit_fini'
        ordering = ['code_produit']

    def __str__(self):
        return f'{self.code_produit} - {self.designation}'


class LotLancementSerie(models.Model):
    class Statut(models.TextChoices):
        PLANIFIE = 'PLANIFIE', 'Planifié'
        EN_COURS = 'EN_COURS', 'En cours de production'
        TERMINE = 'TERMINE', 'Terminé'
        ANNULE = 'ANNULE', 'Annulé'

    id_lot = models.AutoField(primary_key=True)
    num_lot = models.CharField(max_length=50, unique=True)
    prefixe_serie = models.CharField(max_length=10, null=True, blank=True)
    num_debut = models.PositiveIntegerField()
    num_fin = models.PositiveIntegerField()
    quantite_lancee = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    date_lancement = models.DateTimeField()
    statut_prod = models.CharField(
        max_length=30, choices=Statut.choices, default=Statut.PLANIFIE
    )
    config = models.ForeignKey(
        ConfigSerieDocument, on_delete=models.PROTECT,
        db_column='id_config', related_name='lots',
    )
    produit = models.ForeignKey(
        ProduitFini, on_delete=models.PROTECT,
        db_column='id_produit', related_name='lots',
    )
    preparation = models.ForeignKey(
        'commercial.PreparationCommande', on_delete=models.PROTECT, null=True, blank=True,
        db_column='id_preparation', related_name='lots',
    )

    class Meta:
        db_table = 'lot_lancement_serie'
        ordering = ['-date_lancement', '-id_lot']
        constraints = [
            models.UniqueConstraint(
                fields=['config', 'num_debut'], name='uk_lot_config_debut'
            )
        ]
        indexes = [models.Index(fields=['statut_prod'], name='idx_lot_statut')]

    def __str__(self):
        return f'{self.num_lot} [{self.num_debut}-{self.num_fin}]'