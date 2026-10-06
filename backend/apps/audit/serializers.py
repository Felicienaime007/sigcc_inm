import json

from rest_framework import serializers

from .models import AuditLog


class JsonTexteField(serializers.Field):
    """Les valeurs sont stockées en texte JSON : on les rend comme objets."""
    def to_representation(self, value):
        return json.loads(value) if value else None


class AuditLogSerializer(serializers.ModelSerializer):
    ancienne_valeur = JsonTexteField(read_only=True)
    nouvelle_valeur = JsonTexteField(read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            'id_audit', 'date_audit', 'id_utilisateur', 'identifiant_utilisateur',
            'operation', 'table_nom', 'id_objet', 'reference',
            'ancienne_valeur', 'nouvelle_valeur', 'adresse_ip',
        ]
        read_only_fields = fields