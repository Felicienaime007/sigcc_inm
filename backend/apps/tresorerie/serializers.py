from decimal import Decimal

from django.db import IntegrityError, transaction
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from apps.recouvrement.services import apres_reglement
from apps.commercial.models import Facture

from . import services
from .models import (
    NB_FEUILLES, NB_VOLETS_CARNET, VOLETS, Caisse, LivreCaisse, LivreQuittance,
    Quittance, Reglement,
)

Mode = Reglement.Mode


class CaisseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Caisse
        fields = ['id_caisse', 'code_caisse', 'libelle_caisse', 'solde_actuel']
        read_only_fields = ['solde_actuel']


class LivreQuittanceSerializer(serializers.ModelSerializer):
    nb_utilisees = serializers.IntegerField(read_only=True)
    nb_restantes = serializers.SerializerMethodField()

    class Meta:
        model = LivreQuittance
        fields = [
            'id_livre', 'numero_livre', 'annee_ouverture', 'statut_livre',
            'nb_utilisees', 'nb_restantes',
        ]

    def get_nb_restantes(self, obj):
        return NB_VOLETS_CARNET - getattr(obj, 'nb_utilisees', obj.quittances.count())

    def validate(self, attrs):
        inst = self.instance
        if inst is not None:
            used = inst.quittances.count()
            if used and 'numero_livre' in attrs and attrs['numero_livre'] != inst.numero_livre:
                raise serializers.ValidationError(
                    {'numero_livre': "Non modifiable : des quittances sont déjà émises."}
                )
            if attrs.get('statut_livre') == LivreQuittance.Statut.EN_COURS and used >= NB_VOLETS_CARNET:
                raise serializers.ValidationError(
                    {'statut_livre': "Carnet complet : il ne peut plus être EN_COURS."}
                )
        return attrs


class QuittanceSerializer(serializers.ModelSerializer):
    numero_livre = serializers.CharField(source='livre.numero_livre', read_only=True)
    code_caisse = serializers.CharField(source='caisse.code_caisse', read_only=True)
    num_facture = serializers.CharField(
        source='reglement.facture.num_facture', read_only=True, default=None
    )
    montant_regle = serializers.DecimalField(
        source='reglement.montant_regle', max_digits=15, decimal_places=2,
        read_only=True, default=None,
    )

    class Meta:
        model = Quittance
        fields = [
            'id_quittance', 'livre', 'numero_livre', 'num_feuille', 'attribut_volet',
            'date_emission', 'caisse', 'code_caisse',
            'reglement', 'num_facture', 'montant_regle',
        ]
        read_only_fields = fields


class ReglementSerializer(serializers.ModelSerializer):
    # --- Saisie : coordonnées de la quittance physique (espèces / chèque) ---
    caisse = serializers.PrimaryKeyRelatedField(
        queryset=Caisse.objects.all(), write_only=True, required=False
    )
    livre = serializers.PrimaryKeyRelatedField(
        queryset=LivreQuittance.objects.all(), write_only=True, required=False
    )
    num_feuille = serializers.IntegerField(
        min_value=1, max_value=NB_FEUILLES, write_only=True, required=False
    )
    attribut_volet = serializers.ChoiceField(
        choices=list(VOLETS), write_only=True, required=False
    )

    # --- Lecture ---
    num_facture = serializers.CharField(source='facture.num_facture', read_only=True)
    statut_paiement_facture = serializers.CharField(
        source='facture.statut_paiement', read_only=True
    )
    reste_a_payer = serializers.SerializerMethodField()
    quittance = serializers.SerializerMethodField()

    class Meta:
        model = Reglement
        fields = [
            'id_reglement', 'mode_reglement', 'date_reglement', 'montant_regle',
            'num_virement_tresor', 'facture', 'num_facture',
            'statut_paiement_facture', 'reste_a_payer', 'quittance',
            'caisse', 'livre', 'num_feuille', 'attribut_volet',
        ]
        read_only_fields = ['date_reglement']
        extra_kwargs = {'num_virement_tresor': {'required': False, 'allow_null': True}}

    def get_reste_a_payer(self, obj):
        return services.reste_a_payer(obj.facture)

    def get_quittance(self, obj):
        q = getattr(obj, 'quittance', None)
        if q is None:
            return None
        return {
            'numero_livre': q.livre.numero_livre, 'num_feuille': q.num_feuille,
            'attribut_volet': q.attribut_volet, 'code_caisse': q.caisse.code_caisse,
        }

    def validate(self, attrs):
        mode, facture = attrs['mode_reglement'], attrs['facture']
        user = self.context['request'].user
        virement = (attrs.get('num_virement_tresor') or '').strip() or None
        attrs['num_virement_tresor'] = virement
        champs_caisse = ('caisse', 'livre', 'num_feuille', 'attribut_volet')

        if facture.type_facturation == Facture.TypeFacturation.VIREMENT_TRESOR:
            if mode != Mode.VIREMENT_TRESOR:
                raise serializers.ValidationError(
                    {'mode_reglement': "Une facture de SOA se règle par VIREMENT_TRESOR."}
                )
        elif mode == Mode.VIREMENT_TRESOR:
            raise serializers.ValidationError(
                {'mode_reglement': "Une facture à quittance se règle en ESPECES ou CHEQUE."}
            )

        if mode == Mode.VIREMENT_TRESOR:
            if not virement:
                raise serializers.ValidationError(
                    {'num_virement_tresor': "Obligatoire pour un virement du Trésor."}
                )
            if any(c in attrs for c in champs_caisse):
                raise serializers.ValidationError(
                    "Un virement du Trésor n'a ni caisse ni quittance."
                )
            priv = 'reglement.virement'
        else:
            manquants = [c for c in champs_caisse if c not in attrs]
            if manquants:
                raise serializers.ValidationError(
                    {c: "Obligatoire pour un encaissement en caisse." for c in manquants}
                )
            if virement:
                raise serializers.ValidationError(
                    {'num_virement_tresor': "Réservé au mode VIREMENT_TRESOR."}
                )
            priv = 'reglement.encaisser'

        if not user.has_privilege(priv):
            raise PermissionDenied("Vous n'avez pas le privilège pour ce mode de règlement.")
        return attrs

    def create(self, validated):
        caisse = validated.pop('caisse', None)
        livre = validated.pop('livre', None)
        feuille = validated.pop('num_feuille', None)
        volet = validated.pop('attribut_volet', None)

        with transaction.atomic():
            facture = Facture.objects.select_for_update().get(pk=validated['facture'].pk)
            reste = services.reste_a_payer(facture)
            montant = validated['montant_regle']
            if reste <= 0:
                raise serializers.ValidationError({'facture': "Cette facture est déjà soldée."})
            if montant > reste:
                raise serializers.ValidationError({
                    'montant_regle': f"Supérieur au reste à payer ({reste} Ar)."
                })
            validated['facture'] = facture
            reglement = Reglement.objects.create(**validated)

            if caisse is not None:
                livre = LivreQuittance.objects.select_for_update().get(pk=livre.pk)
                if livre.statut_livre != LivreQuittance.Statut.EN_COURS:
                    raise serializers.ValidationError(
                        {'livre': "Ce carnet est épuisé : utilisez un carnet EN_COURS."}
                    )
                caisse = Caisse.objects.select_for_update().get(pk=caisse.pk)
                if Quittance.objects.filter(
                    livre=livre, num_feuille=feuille, attribut_volet=volet
                ).exists():
                    raise serializers.ValidationError({
                        'attribut_volet': f"Quittance {livre.numero_livre} / feuille {feuille} / "
                                          f"volet {volet} déjà utilisée."
                    })
                try:
                    with transaction.atomic():   # point de sauvegarde : filet de sécurité RG-15
                        Quittance.objects.create(
                            livre=livre, num_feuille=feuille, attribut_volet=volet,
                            reglement=reglement, caisse=caisse,
                        )
                except IntegrityError:
                    raise serializers.ValidationError(
                        {'attribut_volet': "Cette quittance vient d'être utilisée."}
                    )

                caisse.solde_actuel += montant
                caisse.save(update_fields=['solde_actuel'])
                LivreCaisse.objects.create(
                    type_operation=LivreCaisse.Type.ENTREE, montant_op=montant,
                    caisse=caisse, reglement=reglement,
                    reference=facture.num_facture,
                )
                if Quittance.objects.filter(livre=livre).count() >= NB_VOLETS_CARNET:
                    livre.statut_livre = LivreQuittance.Statut.EPUISE
                    livre.save(update_fields=['statut_livre'])

            facture.statut_paiement = (
                Facture.StatutPaiement.PAYEE if reste - montant <= Decimal('0')
                else Facture.StatutPaiement.PARTIELLE
            )
            facture.save(update_fields=['statut_paiement'])
            # Synchronise les dossiers de recouvrement actifs de la facture
            apres_reglement(facture)
        return reglement


class LivreCaisseSerializer(serializers.ModelSerializer):
    code_caisse = serializers.CharField(source='caisse.code_caisse', read_only=True)
    num_facture = serializers.CharField(
        source='reglement.facture.num_facture', read_only=True, default=None
    )

    class Meta:
        model = LivreCaisse
        fields = [
            'id_livre_caisse', 'date_operation', 'type_operation', 'montant_op',
            'caisse', 'code_caisse', 'reglement', 'num_facture', 'reference',
        ]
        read_only_fields = ['date_operation', 'reglement']
        # Saisie manuelle : le motif est obligatoire
        extra_kwargs = {'reference': {'required': True, 'allow_null': False, 'allow_blank': False}}

    def create(self, validated):
        with transaction.atomic():
            caisse = Caisse.objects.select_for_update().get(pk=validated['caisse'].pk)
            montant = validated['montant_op']
            if validated['type_operation'] == LivreCaisse.Type.SORTIE:
                if montant > caisse.solde_actuel:
                    raise serializers.ValidationError({
                        'montant_op': f"Solde insuffisant ({caisse.solde_actuel} Ar)."
                    })
                caisse.solde_actuel -= montant
            else:
                caisse.solde_actuel += montant
            caisse.save(update_fields=['solde_actuel'])
            validated['caisse'] = caisse
            return LivreCaisse.objects.create(**validated)