from decimal import Decimal

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from apps.recouvrement.services import apres_reglement
from apps.commercial.models import Facture

from . import services
from .models import (
    COUPURES, NB_FEUILLES, NB_VOLETS_CARNET, VOLETS, ArreteCaisse, Caisse, LivreCaisse,
    LivreQuittance, Quittance, Reglement, RemiseBanque,
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
            'date_emission', 'caisse', 'code_caisse', 'statut',
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
            'statut', 'motif_annulation', 'date_annulation',
            'caisse', 'livre', 'num_feuille', 'attribut_volet',
        ]
        read_only_fields = ['date_reglement', 'statut', 'motif_annulation', 'date_annulation']
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
            'statut': q.statut,
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
            if facture.statut_paiement == Facture.StatutPaiement.ANNULEE:
                raise serializers.ValidationError(
                    {'facture': "Cette facture est annulée : aucun règlement possible."}
                )
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
                if services.journee_cloturee(caisse, timezone.now()):
                    raise serializers.ValidationError(
                        {'caisse': "Journée arrêtée pour cette caisse : encaissement refusé."}
                    )
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
            if services.journee_cloturee(caisse, timezone.now()):
                raise serializers.ValidationError({
                    'caisse': "Journée arrêtée pour cette caisse : écriture refusée."
                })
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


def valider_comptage(detail, montant):
    """Valide le détail du comptage physique par coupure.

    Format attendu : JSON {"20000": 3, "10000": 1, ...} (coupures officielles
    de l'Ariary, quantités entières positives, total égal au montant compté).
    Un texte libre non JSON reste accepté (données historiques).
    """
    import json

    if detail is None or str(detail).strip() == '':
        return
    try:
        donnees = json.loads(detail)
    except (ValueError, TypeError):
        return  # texte libre historique : accepté tel quel
    if not isinstance(donnees, dict) or not donnees:
        raise serializers.ValidationError(
            {'detail_billets': 'Format attendu : {"10000": 12, "5000": 3, ...}.'}
        )
    total = 0
    for coupure, quantite in donnees.items():
        try:
            valeur = int(coupure)
        except (TypeError, ValueError):
            valeur = None
        if valeur not in COUPURES:
            raise serializers.ValidationError(
                {'detail_billets': f"Coupure invalide : {coupure} "
                                   f"(coupures : {', '.join(map(str, COUPURES))})."}
            )
        if isinstance(quantite, bool) or not isinstance(quantite, int) or quantite < 0:
            raise serializers.ValidationError(
                {'detail_billets': f"Quantité invalide pour la coupure {coupure}."}
            )
        total += valeur * quantite
    if montant is not None and Decimal(total) != Decimal(montant):
        raise serializers.ValidationError(
            {'detail_billets': f"Total des coupures ({total} Ar) différent "
                              f"du montant compté ({montant} Ar)."}
        )


class ArreteCaisseSerializer(serializers.ModelSerializer):
    code_caisse = serializers.CharField(source='caisse.code_caisse', read_only=True)
    remises = serializers.SerializerMethodField()

    class Meta:
        model = ArreteCaisse
        fields = [
            'id_arrete', 'caisse', 'code_caisse', 'date_arrete',
            'total_entrees', 'total_sorties', 'solde_theorique',
            'montant_compte', 'ecart', 'detail_billets',
            'statut', 'date_validation', 'remises',
        ]
        read_only_fields = [
            'total_entrees', 'total_sorties', 'solde_theorique',
            'ecart', 'statut', 'date_validation', 'remises',
        ]

    def get_remises(self, obj):
        return [
            {'id_remise': r.pk, 'reference_bordereau': r.reference_bordereau,
             'montant': r.montant, 'statut': r.statut}
            for r in obj.remises.all()
        ]

    def validate(self, attrs):
        caisse = attrs.get('caisse') or getattr(self.instance, 'caisse', None)
        jour = attrs.get('date_arrete') or getattr(self.instance, 'date_arrete', None)
        if self.instance is None and caisse is not None and jour is not None:
            if ArreteCaisse.objects.filter(caisse=caisse, date_arrete=jour).exists():
                raise serializers.ValidationError(
                    {'date_arrete': "Un arrêté existe déjà pour cette caisse à cette date."}
                )
            if services.journee_cloturee(caisse, jour):
                raise serializers.ValidationError(
                    {'date_arrete': "Une journée postérieure est déjà arrêtée."}
                )
        montant = attrs.get('montant_compte')
        if montant is None and self.instance is not None:
            montant = self.instance.montant_compte
        detail = attrs.get('detail_billets', getattr(self.instance, 'detail_billets', None)
                           if self.instance is not None else None)
        if 'detail_billets' in attrs or 'montant_compte' in attrs:
            valider_comptage(detail, montant)
        return attrs


class RemiseBanqueSerializer(serializers.ModelSerializer):
    code_caisse = serializers.CharField(source='caisse.code_caisse', read_only=True)
    date_arrete = serializers.DateField(
        source='arrete.date_arrete', read_only=True, default=None
    )

    class Meta:
        model = RemiseBanque
        fields = [
            'id_remise', 'caisse', 'code_caisse', 'date_remise', 'montant',
            'reference_bordereau', 'modes', 'statut', 'date_statut',
            'arrete', 'date_arrete',
        ]
        read_only_fields = ['statut', 'date_statut', 'date_arrete']
        extra_kwargs = {'arrete': {'required': False, 'allow_null': True}}

    def validate(self, attrs):
        arrete = attrs.get('arrete')
        if arrete is None and self.instance is not None:
            arrete = self.instance.arrete
        if arrete is not None:
            caisse = attrs.get('caisse') or getattr(self.instance, 'caisse', None)
            if caisse is not None and arrete.caisse_id != caisse.pk:
                raise serializers.ValidationError(
                    {'arrete': "L'arrêté doit concerner la même caisse que la remise."}
                )
        return attrs

    def validate_modes(self, value):
        autorises = {'ESPECES', 'CHEQUE'}
        modes = {m.strip().upper() for m in value.split(',') if m.strip()}
        if not modes or not modes <= autorises:
            raise serializers.ValidationError(
                "Modes acceptés : ESPECES et/ou CHEQUE (séparés par une virgule)."
            )
        return ','.join(sorted(modes))