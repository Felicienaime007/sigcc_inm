from rest_framework import serializers

from .models import Commune, District, Fokontany, Province, Region


class ProvinceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Province
        fields = ['id_province', 'nom_province']


class RegionSerializer(serializers.ModelSerializer):
    nom_province = serializers.CharField(source='province.nom_province', read_only=True)

    class Meta:
        model = Region
        fields = ['id_region', 'nom_region', 'province', 'nom_province']


class DistrictSerializer(serializers.ModelSerializer):
    nom_region = serializers.CharField(source='region.nom_region', read_only=True)

    class Meta:
        model = District
        fields = ['id_district', 'nom_district', 'region', 'nom_region']


class CommuneSerializer(serializers.ModelSerializer):
    nom_district = serializers.CharField(source='district.nom_district', read_only=True)

    class Meta:
        model = Commune
        fields = ['id_commune', 'nom_commune', 'type_commune', 'district', 'nom_district']


class FokontanySerializer(serializers.ModelSerializer):
    # Hiérarchie complète en lecture seule (utile pour afficher l'adresse d'un client)
    nom_commune = serializers.CharField(source='commune.nom_commune', read_only=True)
    nom_district = serializers.CharField(source='commune.district.nom_district', read_only=True)
    nom_region = serializers.CharField(source='commune.district.region.nom_region', read_only=True)
    nom_province = serializers.CharField(
        source='commune.district.region.province.nom_province', read_only=True
    )

    class Meta:
        model = Fokontany
        fields = [
            'id_fokontany', 'nom_fokontany', 'commune',
            'nom_commune', 'nom_district', 'nom_region', 'nom_province',
        ]