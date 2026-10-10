from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.commercial.models import LigneAvoir

from .models import ArreteCaisse, Caisse, LivreCaisse, Quittance, Reglement, RemiseBanque

ZERO = Decimal('0')
CENTIMES = Decimal('0.01')


def _taux():
    return getattr(settings, 'TVA_TAUX', Decimal('0.20'))


def total_avoirs_ttc(facture):
    ht = LigneAvoir.objects.filter(avoir__facture=facture).aggregate(
        t=Sum('montant_avoir'))['t'] or ZERO
    return ht + (ht * _taux()).quantize(CENTIMES, rounding=ROUND_HALF_UP)


def total_regle(facture):
    return Reglement.objects.filter(
        facture=facture, statut=Reglement.Statut.ACTIF
    ).aggregate(t=Sum('montant_regle'))['t'] or ZERO


def net_a_payer(facture):
    """TTC de la facture moins les avoirs (TTC)."""
    return facture.montant_ht + facture.tva - total_avoirs_ttc(facture)


def reste_a_payer(facture):
    return net_a_payer(facture) - total_regle(facture)


def journee_cloturee(caisse, date_operation):
    """Vrai si un arrêté VALIDE couvre déjà cette caisse à cette date ou après.

    Un arrêté validé fige toutes les écritures antérieures : on refuse toute
    écriture antidatée sur une journée arrêtée.
    """
    from .models import ArreteCaisse
    jour = date_operation.date() if hasattr(date_operation, 'date') else date_operation
    return ArreteCaisse.objects.filter(
        caisse=caisse, date_arrete__gte=jour, statut=ArreteCaisse.Statut.VALIDE
    ).exists()


def totaux_jour(caisse, jour):
    """Totaux ENTREES/SORTIES du livre de caisse pour (caisse, jour)."""
    from django.db.models import Sum
    from .models import LivreCaisse
    lignes = LivreCaisse.objects.filter(
        caisse=caisse, date_operation__date=jour
    ).values('type_operation').annotate(t=Sum('montant_op'))
    totaux = {l['type_operation']: l['t'] for l in lignes}
    entrees = totaux.get(LivreCaisse.Type.ENTREE, ZERO) or ZERO
    sorties = totaux.get(LivreCaisse.Type.SORTIE, ZERO) or ZERO
    return entrees, sorties


def contrepasser_reglement(reglement, motif):
    """Annule un règlement saisi par erreur, sans jamais le supprimer.

    - Le règlement passe à ANNULE (exclu de total_regle → le reste à payer remonte).
    - La quittance liée passe à ANNULEE (traçabilité du volet annulé).
    - Encaissement en caisse : SORTIE compensatoire + solde décrémenté.
    - Virement du Trésor : aucun mouvement de caisse, simple neutralisation.
    - La quittance physique reste en base (traçabilité, volet non réutilisable).
    Retourne le règlement annulé.
    """
    from apps.recouvrement.services import apres_reglement
    from apps.commercial.models import Facture

    motif = (motif or '').strip()
    if not motif:
        raise ValidationError({'motif_annulation': "Le motif d'annulation est obligatoire."})
    with transaction.atomic():
        reg = Reglement.objects.select_for_update().get(pk=reglement.pk)
        if reg.statut != Reglement.Statut.ACTIF:
            raise ValidationError({'detail': "Ce règlement est déjà annulé."})
        facture = reg.facture
        quittance = getattr(reg, 'quittance', None)
        if quittance is not None:
            caisse = Caisse.objects.select_for_update().get(pk=quittance.caisse_id)
            if journee_cloturee(caisse, timezone.now()):
                raise ValidationError(
                    {'caisse': "Journée arrêtée pour cette caisse : annulation refusée."}
                )
            if reg.montant_regle > caisse.solde_actuel:
                raise ValidationError({
                    'montant_regle': f"Solde insuffisant pour contre-passer "
                                     f"({caisse.solde_actuel} Ar)."
                })
            caisse.solde_actuel -= reg.montant_regle
            caisse.save(update_fields=['solde_actuel'])
            LivreCaisse.objects.create(
                type_operation=LivreCaisse.Type.SORTIE, montant_op=reg.montant_regle,
                caisse=caisse, reglement=reg,
                reference=f"CONTRE-PASSATION {facture.num_facture} (R-{reg.pk})",
            )
            # La quittance physique est annulée avec le règlement (volet non réutilisable)
            Quittance.objects.filter(pk=quittance.pk).update(statut=Quittance.Statut.ANNULEE)
        reg.statut = Reglement.Statut.ANNULE
        reg.motif_annulation = motif
        reg.date_annulation = timezone.now()
        reg.save(update_fields=['statut', 'motif_annulation', 'date_annulation'])
        # Recalcule le statut de la facture avec les seuls règlements ACTIF
        facture = Facture.objects.select_for_update().get(pk=facture.pk)
        total = total_regle(facture)
        if total <= ZERO:
            facture.statut_paiement = Facture.StatutPaiement.NON_PAYEE
        elif net_a_payer(facture) - total <= ZERO:
            facture.statut_paiement = Facture.StatutPaiement.PAYEE
        else:
            facture.statut_paiement = Facture.StatutPaiement.PARTIELLE
        facture.save(update_fields=['statut_paiement'])
        apres_reglement(facture)
        # Alerte : un règlement annulé intéresse la caisse, la comptabilité et la direction
        from apps.audit.context import acteur
        from apps.notifications import services as notifications

        uid = acteur()[0]
        detail = (f"{notifications.ar(reg.montant_regle)} ({reg.get_mode_reglement_display()})"
                  f" — motif : {motif}")
        if quittance is not None:
            detail += (f" — quittance {quittance.livre.numero_livre} / feuille "
                       f"{quittance.num_feuille} / volet {quittance.attribut_volet} annulée")

        def _annoncer_annulation():
            notifications.notifier(
                'reglement.annule', f"Règlement contre-passé : {facture.num_facture}",
                detail, lien='/tresorerie/reglements', exclure=uid,
            )

        notifications.plus_tard(_annoncer_annulation)
    return reg


def valider_arrete(arrete):
    """Fige la journée : snapshot des totaux, solde théorique, écart."""
    with transaction.atomic():
        arr = ArreteCaisse.objects.select_for_update().get(pk=arrete.pk)
        if arr.statut != ArreteCaisse.Statut.BROUILLON:
            raise ValidationError({'detail': "Cet arrêté est déjà validé."})
        caisse = Caisse.objects.select_for_update().get(pk=arr.caisse_id)
        entrees, sorties = totaux_jour(caisse, arr.date_arrete)
        arr.total_entrees = entrees
        arr.total_sorties = sorties
        arr.solde_theorique = caisse.solde_actuel
        arr.ecart = (arr.montant_compte or ZERO) - caisse.solde_actuel
        arr.statut = ArreteCaisse.Statut.VALIDE
        arr.date_validation = timezone.now()
        arr.save(update_fields=[
            'total_entrees', 'total_sorties', 'solde_theorique',
            'ecart', 'statut', 'date_validation',
        ])
        # Alerte : une clôture avec écart intéresse la comptabilité et la direction
        if arr.ecart is not None and arr.ecart != ZERO:
            from apps.audit.context import acteur
            from apps.notifications import services as notifications

            uid = acteur()[0]
            jour = arr.date_arrete.strftime('%d/%m/%Y')

            def _annoncer_ecart():
                notifications.notifier(
                    'caisse.ecart', f"Écart de caisse : {caisse.code_caisse} ({jour})",
                    f"Journée clôturée : compté {notifications.ar(arr.montant_compte or ZERO)} "
                    f"pour {notifications.ar(arr.solde_theorique)} théorique, "
                    f"soit un écart de {notifications.ar(arr.ecart)}.",
                    lien='/tresorerie/caisses', exclure=uid,
                )

            notifications.plus_tard(_annoncer_ecart)
    return arr


def remettre_en_banque(remise):
    """Exécute une remise PRÉPARÉE : SORTIE de caisse + solde décrémenté."""
    with transaction.atomic():
        rem = RemiseBanque.objects.select_for_update().get(pk=remise.pk)
        if rem.statut != RemiseBanque.Statut.PREPAREE:
            raise ValidationError({'detail': "Cette remise est déjà effectuée."})
        caisse = Caisse.objects.select_for_update().get(pk=rem.caisse_id)
        if journee_cloturee(caisse, timezone.now()):
            raise ValidationError(
                {'caisse': "Journée arrêtée pour cette caisse : remise refusée."}
            )
        if rem.montant > caisse.solde_actuel:
            raise ValidationError({
                'montant': f"Solde insuffisant ({caisse.solde_actuel} Ar)."
            })
        caisse.solde_actuel -= rem.montant
        caisse.save(update_fields=['solde_actuel'])
        LivreCaisse.objects.create(
            type_operation=LivreCaisse.Type.SORTIE, montant_op=rem.montant,
            caisse=caisse,
            reference=f"REMISE BANQUE {rem.reference_bordereau}",
        )
        rem.statut = RemiseBanque.Statut.REMISE
        rem.date_statut = timezone.now()
        rem.save(update_fields=['statut', 'date_statut'])
    return rem