from django.db import models
from django.utils import timezone


class AuditQuerySet(models.QuerySet):
    """Le journal d'audit est immuable (RG-18)."""

    def update(self, **kwargs):
        raise RuntimeError("AUDIT_LOG est immuable : modification interdite.")

    def bulk_update(self, objs, fields, batch_size=None):
        raise RuntimeError("AUDIT_LOG est immuable : modification interdite.")

    def delete(self):
        raise RuntimeError("AUDIT_LOG est immuable : suppression interdite.")


class AuditLog(models.Model):
    class Operation(models.TextChoices):
        CREATE = 'CREATE', 'Création'
        UPDATE = 'UPDATE', 'Modification'
        DELETE = 'DELETE', 'Suppression'

    id_audit = models.AutoField(primary_key=True)
    date_audit = models.DateTimeField(default=timezone.now)
    # Pas de clé étrangère : l'audit doit survivre à la suppression d'un compte
    id_utilisateur = models.IntegerField(null=True, blank=True)
    identifiant_utilisateur = models.CharField(max_length=50)     # ou SYSTEME / ANONYME
    operation = models.CharField(max_length=10, choices=Operation.choices)
    table_nom = models.CharField(max_length=50)
    id_objet = models.CharField(max_length=50)
    reference = models.CharField(max_length=100, null=True, blank=True)  # n° de document
    ancienne_valeur = models.TextField(null=True, blank=True)    # JSON
    nouvelle_valeur = models.TextField(null=True, blank=True)    # JSON
    adresse_ip = models.CharField(max_length=45, null=True, blank=True)

    objects = AuditQuerySet.as_manager()

    class Meta:
        db_table = 'audit_log'
        ordering = ['-date_audit', '-id_audit']
        indexes = [
            models.Index(fields=['table_nom', 'id_objet'], name='idx_audit_table_obj'),
            models.Index(fields=['date_audit'], name='idx_audit_date'),
        ]

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise RuntimeError("AUDIT_LOG est immuable : modification interdite.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise RuntimeError("AUDIT_LOG est immuable : suppression interdite.")

    def __str__(self):
        return f'{self.operation} {self.table_nom}#{self.id_objet}'