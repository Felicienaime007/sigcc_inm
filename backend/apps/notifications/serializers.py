from rest_framework import serializers

from apps.users.models import Role

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    lu = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = ['id_notification', 'type_notif', 'niveau', 'titre', 'message', 'lien', 'cree_le', 'lu', 'lu_le']
        read_only_fields = fields

    def get_lu(self, obj):
        return obj.lu_le is not None


class AnnonceSerializer(serializers.Serializer):
    titre = serializers.CharField(max_length=150)
    message = serializers.CharField(max_length=500, required=False, allow_blank=True)
    niveau = serializers.ChoiceField(choices=Notification.Niveau.choices, default=Notification.Niveau.INFO)
    lien = serializers.CharField(max_length=200, required=False, allow_blank=True)
    tous = serializers.BooleanField(default=False)
    roles = serializers.ListField(child=serializers.CharField(max_length=50), required=False)

    def validate_lien(self, valeur):
        if valeur and (not valeur.startswith('/') or valeur.startswith('//')):
            raise serializers.ValidationError("Le lien doit être une page de l'application (ex. /commercial/factures).")
        return valeur

    def validate(self, attrs):
        roles = set(attrs.get('roles') or [])
        if not attrs['tous'] and not roles:
            raise serializers.ValidationError({'roles': "Choisissez au moins un rôle, ou « tous les utilisateurs »."})
        if roles and Role.objects.filter(libelle_role__in=roles).count() != len(roles):
            raise serializers.ValidationError({'roles': "Rôle inconnu."})
        return attrs