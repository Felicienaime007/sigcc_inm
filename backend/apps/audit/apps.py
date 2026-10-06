from django.apps import AppConfig


class AuditConfig(AppConfig):
    default_auto_field = 'django.db.models.AutoField'
    name = 'apps.audit'
    label = 'audit'
    verbose_name = 'Audit & traçabilité'

    def ready(self):
        from . import signals
        signals.connecter()