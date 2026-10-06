from django.apps import AppConfig


class ProduitsConfig(AppConfig):
    default_auto_field = 'django.db.models.AutoField'
    name = 'apps.produits'
    label = 'produits'
    verbose_name = 'Catalogue produits & séries'