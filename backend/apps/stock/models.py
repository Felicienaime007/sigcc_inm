from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone


class MagasinDepot(models.Model):
    id_magasin = models.AutoField(primary_key=True)
    nom_magasin = models.CharField(max_length=100)
    code_depot = models.CharField(max_length=20, unique=True)

    class Meta:
        db_table = 'magasin_depot'
        ordering = ['code_depot']

    def __str__(self):
        return f'{self.code_depot} - {self.nom_magasin}'


class Emplacement(models.Model):
    id_emplacement = models.AutoField(primary_key=True)
    code_allee = models.CharField(max_length=10)
    code_etagere = models.CharField(max_length=10)
    magasin = models.ForeignKey(
        MagasinDepot, on_delete=models.PROTECT,
        db_column='id_magasin', related_name='emplacements',
    )

    class Meta:
        db_table = 'emplacement'
        ordering = ['magasin', 'code_allee', 'code_etagere']
        constraints = [
            models.UniqueConstraint(
                fields=['magasin', 'code_allee', 'code_etagere'],
                name='uk_empl_mag_allee_etag',
            )
        ]

    def __str__(self):
        return f'{self.magasin.code_depot}/{self.code_allee}-{self.code_etagere}'


class LigneStock(models.Model):
    """Modifiée uniquement par apps/stock/services.py."""
    emplacement = models.ForeignKey(
        Emplacement, on_delete=models.PROTECT,
        db_column='id_emplacement', related_name='lignes_stock',
    )
    produit = models.ForeignKey(
        'produits.ProduitFini', on_delete=models.PROTECT,
        db_column='id_produit', related_name='lignes_stock',
    )
    quantite_physique = models.PositiveIntegerField(default=0)
    quantite_reservee = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'ligne_stock'
        constraints = [
            models.UniqueConstraint(
                fields=['emplacement', 'produit'], name='uk_lignestock_empl_prod'
            )
        ]

    @property
    def disponible(self):
        return self.quantite_physique - self.quantite_reservee


class ReservationStock(models.Model):
    id_reservation = models.AutoField(primary_key=True)
    quantite_bloquee = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    date_limite = models.DateTimeField()
    preparation = models.ForeignKey(
        'commercial.PreparationCommande', on_delete=models.PROTECT, null=True, blank=True,
        db_column='id_preparation', related_name='reservations',
    )
    produit = models.ForeignKey(
        'produits.ProduitFini', on_delete=models.PROTECT,
        db_column='id_produit', related_name='reservations',
    )

    class Meta:
        db_table = 'reservation_stock'
        ordering = ['date_limite', 'id_reservation']

    def __str__(self):
        return f'Réservation {self.quantite_bloquee} x {self.produit_id}'


class MouvementStock(models.Model):
    class Type(models.TextChoices):
        ENTREE_PRODUCTION = 'ENTREE_PRODUCTION', 'Entrée : fin de lot de production'
        ENTREE_RETOUR = 'ENTREE_RETOUR', 'Entrée : retour client (avoir)'
        ENTREE_INITIAL = 'ENTREE_INITIAL', 'Entrée : stock initial / inventaire'
        ENTREE_AJUSTEMENT = 'ENTREE_AJUSTEMENT', 'Entrée : ajustement'
        SORTIE_LIVRAISON = 'SORTIE_LIVRAISON', 'Sortie : livraison'
        SORTIE_AJUSTEMENT = 'SORTIE_AJUSTEMENT', 'Sortie : ajustement (casse, perte)'
        TRANSFERT_SORTIE = 'TRANSFERT_SORTIE', 'Transfert : sortie'
        TRANSFERT_ENTREE = 'TRANSFERT_ENTREE', 'Transfert : entrée'

    id_mouvement = models.AutoField(primary_key=True)
    type_mouvement = models.CharField(max_length=30, choices=Type.choices)
    quantite_mouv = models.PositiveIntegerField(validators=[MinValueValidator(1)])  # toujours > 0
    date_mouv = models.DateTimeField(default=timezone.now)
    produit = models.ForeignKey(
        'produits.ProduitFini', on_delete=models.PROTECT,
        db_column='id_produit', related_name='mouvements',
    )
    livraison = models.ForeignKey(
        'commercial.BonLivraison', on_delete=models.PROTECT, null=True, blank=True,
        db_column='id_livraison', related_name='mouvements',
    )
    # Ajouts par rapport au MLD
    emplacement = models.ForeignKey(
        Emplacement, on_delete=models.PROTECT, null=True, blank=True,
        db_column='id_emplacement', related_name='mouvements',
    )
    reference = models.CharField(max_length=100, null=True, blank=True)

    class Meta:
        db_table = 'mouvement_stock'
        ordering = ['-date_mouv', '-id_mouvement']
        indexes = [
            models.Index(fields=['type_mouvement'], name='idx_mouv_type'),
            models.Index(fields=['produit', 'date_mouv'], name='idx_mouv_produit_date'),
        ]

    def __str__(self):
        return f'{self.type_mouvement} {self.quantite_mouv} x {self.produit_id}'