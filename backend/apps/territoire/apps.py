from django.apps import AppConfig


class TerritoireConfig(AppConfig):
    default_auto_field = 'django.db.models.AutoField'
    name = 'apps.territoire'
    label = 'territoire'
    verbose_name = 'Découpage territorial'