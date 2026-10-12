from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import Privilege, Role, Utilisateur


class PrivilegeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Privilege
        fields = ['id_privilege', 'code_action', 'description']


class RoleSerializer(serializers.ModelSerializer):
    privileges = PrivilegeSerializer(many=True, read_only=True)
    privilege_ids = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Privilege.objects.all(),
        source='privileges', write_only=True, required=False,
    )
    nb_utilisateurs = serializers.IntegerField(read_only=True)

    class Meta:
        model = Role
        fields = ['id_role', 'libelle_role', 'privileges', 'privilege_ids', 'nb_utilisateurs']

    def validate_libelle_role(self, value):
        # Le code lit le rôle ADMIN par son nom : il ne doit jamais être renommé
        if self.instance and self.instance.libelle_role == 'ADMIN' and value != 'ADMIN':
            raise serializers.ValidationError("Le rôle ADMIN ne peut pas être renommé.")
        return value

    def create(self, validated_data):
        privileges = validated_data.pop('privileges', [])
        role = Role.objects.create(**validated_data)
        role.privileges.set(privileges)
        return role

    def update(self, instance, validated_data):
        privileges = validated_data.pop('privileges', None)
        instance = super().update(instance, validated_data)
        if privileges is not None:
            instance.privileges.set(privileges)
        return instance

class RoleLightSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ['id_role', 'libelle_role']


class UtilisateurSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, style={'input_type': 'password'})
    roles = RoleLightSerializer(many=True, read_only=True)
    role_ids = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Role.objects.all(),
        source='roles', write_only=True, required=False,
    )

    class Meta:
        model = Utilisateur
        fields = [
            'id_utilisateur', 'matricule', 'nom_complet', 'identifiant',
            'statut_compte', 'password', 'roles', 'role_ids', 'last_login',
            'photo',
        ]
        # La photo s'écrit uniquement via l'action dédiée `photo`
        # (l'utilisateur modifie la sienne, l'admin celle de chacun).
        read_only_fields = ['last_login', 'photo']

    def validate_password(self, value):
        validate_password(value)
        return value

    def validate(self, attrs):
        if self.instance is None and not attrs.get('password'):
            raise serializers.ValidationError({'password': 'Le mot de passe est obligatoire.'})
        return attrs

    def create(self, validated_data):
        roles = validated_data.pop('roles', [])
        password = validated_data.pop('password')
        user = Utilisateur.objects.create_user(password=password, **validated_data)
        user.roles.set(roles)
        return user

    def update(self, instance, validated_data):
        roles = validated_data.pop('roles', None)
        password = validated_data.pop('password', None)
        instance = super().update(instance, validated_data)
        if password:
            instance.set_password(password)
            instance.save(update_fields=['password'])
        if roles is not None:
            instance.roles.set(roles)
        return instance


class SetPasswordSerializer(serializers.Serializer):
    new_password = serializers.CharField(write_only=True)

    def validate_new_password(self, value):
        validate_password(value)
        return value