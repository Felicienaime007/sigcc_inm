from django.db import models


class Province(models.Model):
    id_province = models.AutoField(primary_key=True)
    nom_province = models.CharField(max_length=100, unique=True)

    class Meta:
        db_table = 'province'
        ordering = ['nom_province']

    def __str__(self):
        return self.nom_province


class Region(models.Model):
    id_region = models.AutoField(primary_key=True)
    nom_region = models.CharField(max_length=100)
    province = models.ForeignKey(
        Province, on_delete=models.PROTECT,
        db_column='id_province', related_name='regions',
    )

    class Meta:
        db_table = 'region'
        ordering = ['nom_region']
        constraints = [
            models.UniqueConstraint(
                fields=['province', 'nom_region'], name='uk_region_province_nom'
            )
        ]

    def __str__(self):
        return self.nom_region


class District(models.Model):
    id_district = models.AutoField(primary_key=True)
    nom_district = models.CharField(max_length=100)
    region = models.ForeignKey(
        Region, on_delete=models.PROTECT,
        db_column='id_region', related_name='districts',
    )

    class Meta:
        db_table = 'district'
        ordering = ['nom_district']
        constraints = [
            models.UniqueConstraint(
                fields=['region', 'nom_district'], name='uk_district_region_nom'
            )
        ]

    def __str__(self):
        return self.nom_district


class Commune(models.Model):
    class TypeCommune(models.TextChoices):
        URBAINE = 'URBAINE', 'Urbaine'
        RURALE = 'RURALE', 'Rurale'

    id_commune = models.AutoField(primary_key=True)
    nom_commune = models.CharField(max_length=100)
    type_commune = models.CharField(max_length=20, choices=TypeCommune.choices)
    district = models.ForeignKey(
        District, on_delete=models.PROTECT,
        db_column='id_district', related_name='communes',
    )

    class Meta:
        db_table = 'commune'
        ordering = ['nom_commune']
        constraints = [
            models.UniqueConstraint(
                fields=['district', 'nom_commune'], name='uk_commune_district_nom'
            )
        ]

    def __str__(self):
        return self.nom_commune


class Fokontany(models.Model):
    id_fokontany = models.AutoField(primary_key=True)
    nom_fokontany = models.CharField(max_length=100)
    commune = models.ForeignKey(
        Commune, on_delete=models.PROTECT,
        db_column='id_commune', related_name='fokontany',
    )

    class Meta:
        db_table = 'fokontany'
        verbose_name_plural = 'fokontany'
        ordering = ['nom_fokontany']
        constraints = [
            models.UniqueConstraint(
                fields=['commune', 'nom_fokontany'], name='uk_fokontany_commune_nom'
            )
        ]

    def __str__(self):
        return self.nom_fokontany