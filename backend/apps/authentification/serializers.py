from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


class ProfilSerializer(serializers.Serializer):
    """Profil de l'utilisateur connecté (utilisé par /me et à la connexion)."""
    id_utilisateur = serializers.IntegerField()
    matricule = serializers.CharField()
    nom_complet = serializers.CharField()
    identifiant = serializers.CharField()
    statut_compte = serializers.CharField()
    roles = serializers.SerializerMethodField()
    privileges = serializers.SerializerMethodField()

    def get_roles(self, user):
        return user.role_codes

    def get_privileges(self, user):
        return sorted(user.get_privileges())


class LoginSerializer(TokenObtainPairSerializer):
    default_error_messages = {
        'no_active_account': "Identifiant ou mot de passe incorrect, ou compte non actif.",
    }

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['nom_complet'] = user.nom_complet
        token['roles'] = user.role_codes
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data['user'] = ProfilSerializer(self.user).data
        return data


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    def validate_old_password(self, value):
        if not self.context['request'].user.check_password(value):
            raise serializers.ValidationError('Ancien mot de passe incorrect.')
        return value

    def validate_new_password(self, value):
        validate_password(value, self.context['request'].user)
        return value