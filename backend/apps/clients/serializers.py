import re

from .permissions import types_geres
from rest_framework import serializers

from .models import Client, Organisme, SolvabiliteClient


class OrganismeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organisme
        fields = ['id_organisme', 'nom_organisme', 'code_institutionnel']


class SolvabiliteClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = SolvabiliteClient
        fields = [
            'id_solvabilite', 'client', 'score_credit',
            'plafond_encours', 'statut_blocage',
        ]

    def validate(self, attrs):
        instance = self.instance or SolvabiliteClient()
        for field, value in attrs.items():
            setattr(instance, field, value)
        try:
            instance.full_clean(exclude=None)
        except Exception as exc:
            from django.core.exceptions import ValidationError as DjangoVE

            if isinstance(exc, DjangoVE) and hasattr(exc, 'message_dict'):
                raise serializers.ValidationError(exc.message_dict)
            raise serializers.ValidationError(str(exc))
        return attrs


SOA = (Client.TypeClient.MINISTERE, Client.TypeClient.CTD)


class ClientSerializer(serializers.ModelSerializer):
    # Lecture seule : adresse administrative (SOA) ou ville (PRIVE, SIMPLE)
    nom_fokontany = serializers.CharField(
        source='fokontany.nom_fokontany', read_only=True, default=None)
    nom_commune = serializers.CharField(
        source='fokontany.commune.nom_commune', read_only=True, default=None)
    nom_district = serializers.CharField(
        source='fokontany.commune.district.nom_district', read_only=True, default=None)
    nom_region = serializers.CharField(
        source='fokontany.commune.district.region.nom_region', read_only=True, default=None)
    nom_organisme = serializers.CharField(
        source='organisme.nom_organisme', read_only=True, default=None)
    localisation = serializers.SerializerMethodField()
    solvabilite = SolvabiliteClientSerializer(read_only=True)

    class Meta:
        model = Client
        fields = [
            'id_client', 'code_soa', 'nom_client', 'type_client',
            'adresse', 'telephone', 'cin_ou_nif', 'ville',
            'fokontany', 'nom_fokontany', 'nom_commune', 'nom_district', 'nom_region',
            'organisme', 'nom_organisme', 'localisation', 'solvabilite',
        ]

    def get_localisation(self, obj):
        if obj.fokontany_id:
            return f'{obj.fokontany.nom_fokontany}, {obj.fokontany.commune.nom_commune}'
        return obj.ville or ''

    def validate(self, attrs):
        request = self.context.get('request')
        inst = self.instance

        # --- 1. Droits par type de client (réception : SIMPLE ; commercial : les trois autres)
        if request is not None:
            user = request.user
            if inst is None:
                autorises = types_geres(user, 'create')
                if attrs.get('type_client') not in autorises:
                    raise serializers.ValidationError({
                        'type_client': "Votre rôle ne permet pas de créer ce type de client "
                                       f"(autorisés : {', '.join(sorted(autorises)) or 'aucun'})."
                    })
            else:
                autorises = types_geres(user, 'update')
                nouveau = attrs.get('type_client', inst.type_client)
                if inst.type_client not in autorises or nouveau not in autorises:
                    raise serializers.ValidationError({
                        'type_client': "Votre rôle ne permet pas de modifier ce type de client "
                                       f"(autorisés : {', '.join(sorted(autorises)) or 'aucun'})."
                    })

        # --- 2. Valeurs finales (PATCH partiel : on complète avec l'existant)
        def val(champ):
            return attrs[champ] if champ in attrs else getattr(inst, champ, None)

        type_ = val('type_client')
        code_soa = (val('code_soa') or '').strip()
        ville = (val('ville') or '').strip()
        organisme, fokontany = val('organisme'), val('fokontany')
        attrs['ville'] = ville or None
        erreurs = {}

        if type_ in SOA:
            if not re.fullmatch(r'\d{5}', code_soa):
                erreurs['code_soa'] = "Le code SOA comporte exactement 5 chiffres."
            if organisme is None:
                erreurs['organisme'] = "Un SOA doit être rattaché à son organisme."
            if fokontany is None:
                erreurs['fokontany'] = "L'adresse administrative (jusqu'au fokontany) est obligatoire pour un SOA."
            if ville:
                erreurs['ville'] = "La localisation par ville n'est pas utilisée pour un SOA."
        else:
            if code_soa:
                erreurs['code_soa'] = "Le code SOA est réservé aux SOA (MINISTERE, CTD)."
            if organisme is not None:
                erreurs['organisme'] = "Un organisme n'est autorisé que pour un SOA."
            if fokontany is not None:
                erreurs['fokontany'] = "L'adresse administrative est réservée aux SOA : indiquez la ville."
            if not ville:
                erreurs['ville'] = "La ville est obligatoire."
        if erreurs:
            raise serializers.ValidationError(erreurs)

        # --- 3. On ne quitte pas le type PRIVE tant qu'une fiche de solvabilité existe
        if inst is not None and type_ != Client.TypeClient.PRIVE and hasattr(inst, 'solvabilite'):
            raise serializers.ValidationError({
                'type_client': "Ce client a une fiche de solvabilité : "
                               "supprimez-la avant de changer son type."
            })
        return attrs