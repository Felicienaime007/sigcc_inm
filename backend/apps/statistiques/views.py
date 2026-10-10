from collections import defaultdict
from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings
from django.db.models import (
    Count, DecimalField, ExpressionWrapper, F, Min, OuterRef, Subquery, Sum, Value,
)
from django.db.models.functions import Coalesce, ExtractMonth
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentification.permissions import HasPrivilege
from apps.budget.models import Budget, EngagementBudget, LigneBudgetaire
from apps.commercial.models import Commande, Facture, LigneAvoir, LigneFacture
from apps.produits.models import LotLancementSerie, ProduitFini
from apps.recouvrement.models import LigneRecouvrement, Recouvrement
from apps.recouvrement.services import ACTIFS, jours_retard
from apps.stock.models import LigneStock
from apps.tresorerie.models import Caisse, Reglement

ZERO = Decimal('0')
CENT = Decimal('0.01')
MONEY = DecimalField(max_digits=20, decimal_places=2)


def f(valeur):
    """Les montants sont renvoyés en nombres (suffisant pour des graphiques et des totaux)."""
    return float(valeur or 0)


def serie_mensuelle(qs, champ_date, champ_somme):
    """12 valeurs (janvier à décembre) pour un queryset déjà filtré sur l'année."""
    lignes = (
        qs.annotate(m=ExtractMonth(champ_date)).values('m')
        .annotate(t=Sum(champ_somme)).order_by()
    )
    par_mois = {r['m']: r['t'] for r in lignes}
    return [f(par_mois.get(m)) for m in range(1, 13)]


def ca_net(annee):
    ht = Facture.objects.filter(date_facture__year=annee).aggregate(t=Sum('montant_ht'))['t'] or ZERO
    av = LigneAvoir.objects.filter(avoir__date_avoir__year=annee).aggregate(t=Sum('montant_avoir'))['t'] or ZERO
    return ht - av


# ---------------------------------------------------------------- Sections
def section_ventes(annee):
    fac = Facture.objects.filter(date_facture__year=annee)
    tot = fac.aggregate(ht=Sum('montant_ht'), tva=Sum('tva'), n=Count('pk'))
    avoirs = LigneAvoir.objects.filter(avoir__date_avoir__year=annee)
    avoirs_ht = avoirs.aggregate(t=Sum('montant_avoir'))['t'] or ZERO
    ht = tot['ht'] or ZERO

    par_type = defaultdict(lambda: [ZERO, 0])
    for r in fac.order_by().values('commande__client__type_client', 'client__type_client').annotate(
        ht=Sum('montant_ht'), n=Count('pk')
    ):
        cle = r['commande__client__type_client'] or r['client__type_client']   # comptoir : pas de commande
        par_type[cle][0] += r['ht'] or ZERO
        par_type[cle][1] += r['n']

    clients = {}
    for r in fac.order_by().values(
        'commande__client_id', 'client_id', 'commande__client__nom_client', 'client__nom_client'
    ).annotate(ht=Sum('montant_ht'), n=Count('pk')):
        cid = r['commande__client_id'] or r['client_id']
        nom = r['commande__client__nom_client'] or r['client__nom_client']
        a = clients.setdefault(cid, {'client': cid, 'nom_client': nom, 'ht': ZERO, 'n': 0})
        a['ht'] += r['ht'] or ZERO
        a['n'] += r['n']
    top_clients = sorted(clients.values(), key=lambda a: a['ht'], reverse=True)[:5]

    montant_ligne = ExpressionWrapper(F('quantite_facturee') * F('prix_unitaire'), output_field=MONEY)
    top_produits = (
        LigneFacture.objects.filter(facture__date_facture__year=annee)
        .values('produit_id', 'produit__code_produit', 'produit__designation')
        .annotate(qte=Sum('quantite_facturee'), ca=Sum(montant_ligne))
        .order_by('-ca')[:5]
    )

    return {
        'ht': f(ht), 'tva': f(tot['tva']), 'ttc': f(ht + (tot['tva'] or ZERO)),
        'nb_factures': tot['n'], 'avoirs_ht': f(avoirs_ht),
        'ca_net': f(ht - avoirs_ht), 'ca_net_precedent': f(ca_net(annee - 1)),
        'mensuel_facture': serie_mensuelle(fac, 'date_facture', 'montant_ht'),
        'mensuel_avoirs': serie_mensuelle(avoirs, 'avoir__date_avoir', 'montant_avoir'),
        'par_type_client': [
            {'type': t, 'ht': f(v[0]), 'n': v[1]}
            for t, v in sorted(par_type.items(), key=lambda kv: kv[1][0], reverse=True)
        ],
        'top_clients': [
            {'client': a['client'], 'nom_client': a['nom_client'], 'ht': f(a['ht']), 'n': a['n']}
            for a in top_clients
        ],
        'top_produits': [
            {'produit': r['produit_id'], 'code_produit': r['produit__code_produit'],
             'designation': r['produit__designation'], 'quantite': r['qte'], 'ca': f(r['ca'])}
            for r in top_produits
        ],
        'par_statut_paiement': [
            {'statut': r['statut_paiement'], 'n': r['n'], 'ht': f(r['ht'])}
            for r in fac.order_by().values('statut_paiement').annotate(n=Count('pk'), ht=Sum('montant_ht'))
        ],
    }


def section_encaissements(annee):
    reg = Reglement.objects.filter(date_reglement__year=annee, statut=Reglement.Statut.ACTIF)
    tot = reg.aggregate(t=Sum('montant_regle'), n=Count('pk'))
    return {
        'total': f(tot['t']), 'nb': tot['n'],
        'mensuel': serie_mensuelle(reg, 'date_reglement', 'montant_regle'),
        'par_mode': [
            {'mode': r['mode_reglement'], 'total': f(r['t']), 'n': r['n']}
            for r in reg.order_by().values('mode_reglement').annotate(t=Sum('montant_regle'), n=Count('pk'))
        ],
    }


def section_creances():
    regle = (Reglement.objects.filter(
        facture=OuterRef('pk'), statut=Reglement.Statut.ACTIF).order_by()
        .values('facture').annotate(t=Sum('montant_regle')).values('t'))
    avoir = (LigneAvoir.objects.filter(avoir__facture=OuterRef('pk')).order_by()
             .values('avoir__facture').annotate(t=Sum('montant_avoir')).values('t'))
    ouvertes = Facture.objects.filter(
        statut_paiement__in=[Facture.StatutPaiement.NON_PAYEE, Facture.StatutPaiement.PARTIELLE]
    ).annotate(
        regle=Coalesce(Subquery(regle, output_field=MONEY), Value(ZERO), output_field=MONEY),
        avoir_ht=Coalesce(Subquery(avoir, output_field=MONEY), Value(ZERO), output_field=MONEY),
    )

    taux = getattr(settings, 'TVA_TAUX', Decimal('0.20'))
    tranches = [
        ['echeance', "Non échues", ZERO, 0],
        ['t30', "1 à 30 jours de retard", ZERO, 0],
        ['t60', "31 à 60 jours", ZERO, 0],
        ['t90', "61 à 90 jours", ZERO, 0],
        ['t90p', "Plus de 90 jours", ZERO, 0],
    ]
    par_mode = defaultdict(lambda: [ZERO, 0])
    total, nb, en_retard, nb_retard = ZERO, 0, ZERO, 0

    for fa in ouvertes:
        avoir_ttc = fa.avoir_ht + (fa.avoir_ht * taux).quantize(CENT, rounding=ROUND_HALF_UP)
        reste = fa.montant_ht + fa.tva - avoir_ttc - fa.regle
        if reste <= 0:
            continue
        retard = jours_retard(fa)
        idx = 0 if retard == 0 else 1 if retard <= 30 else 2 if retard <= 60 else 3 if retard <= 90 else 4
        tranches[idx][2] += reste
        tranches[idx][3] += 1
        par_mode[fa.type_facturation][0] += reste
        par_mode[fa.type_facturation][1] += 1
        total += reste
        nb += 1
        if retard > 0:
            en_retard += reste
            nb_retard += 1

    return {
        'total': f(total), 'nb': nb, 'en_retard': f(en_retard), 'nb_en_retard': nb_retard,
        'tranches': [{'cle': t[0], 'label': t[1], 'total': f(t[2]), 'n': t[3]} for t in tranches],
        'par_mode': [{'type_facturation': k, 'total': f(v[0]), 'n': v[1]} for k, v in par_mode.items()],
    }


def section_commandes(annee):
    return {
        'par_statut': [
            {'statut': r['statut_commande'], 'n': r['n']}
            for r in Commande.objects.filter(date_commande__year=annee)
            .order_by().values('statut_commande').annotate(n=Count('pk'))
        ]
    }


def section_budget(annee):
    dispo = {
        r['budget_id']: r['t'] for r in LigneBudgetaire.objects.filter(budget__annee_budgetaire=annee)
        .order_by().values('budget_id').annotate(t=Sum('montant_disponible'))
    }
    engage = {
        r['ligne_budget__budget_id']: r['t'] for r in EngagementBudget.objects.filter(
            ligne_budget__budget__annee_budgetaire=annee,
            statut_engagement__in=[EngagementBudget.Statut.VISE, EngagementBudget.Statut.SOLDE],
        ).order_by().values('ligne_budget__budget_id').annotate(t=Sum('montant_engage'))
    }
    organismes = []
    tot = {'alloue': ZERO, 'dotation': ZERO, 'engage': ZERO, 'disponible': ZERO}
    for b in Budget.objects.filter(annee_budgetaire=annee).select_related('organisme').order_by('organisme__nom_organisme'):
        d, e = dispo.get(b.pk) or ZERO, engage.get(b.pk) or ZERO
        dotation = d + e
        organismes.append({
            'organisme': b.organisme.nom_organisme, 'alloue': f(b.montant_alloue),
            'dotation': f(dotation), 'engage': f(e), 'disponible': f(d),
            'taux': round(float(e / dotation * 100), 1) if dotation else 0.0,
        })
        tot['alloue'] += b.montant_alloue
        tot['dotation'] += dotation
        tot['engage'] += e
        tot['disponible'] += d
    return {'annee': annee, **{k: f(v) for k, v in tot.items()}, 'organismes': organismes}


def section_stock():
    produits = []
    for r in LigneStock.objects.order_by().values(
        'produit_id', 'produit__code_produit', 'produit__designation'
    ).annotate(p=Sum('quantite_physique'), r=Sum('quantite_reservee')):
        produits.append({
            'produit': r['produit_id'], 'code_produit': r['produit__code_produit'],
            'designation': r['produit__designation'],
            'physique': r['p'] or 0, 'reserve': r['r'] or 0, 'disponible': (r['p'] or 0) - (r['r'] or 0),
        })
    valeur = LigneStock.objects.aggregate(
        t=Sum(ExpressionWrapper(F('quantite_physique') * F('produit__prix_tarif'), output_field=MONEY))
    )['t']
    return {
        'valeur': f(valeur), 'nb_produits_en_stock': len(produits),
        'nb_ruptures': sum(1 for p in produits if p['disponible'] <= 0),
        'sans_stock': ProduitFini.objects.filter(lignes_stock__isnull=True).count(),
        'plus_faibles': sorted(produits, key=lambda p: p['disponible'])[:8],
    }


def section_production(annee):
    return {
        'a_faire': LotLancementSerie.objects.filter(
            statut_prod__in=[LotLancementSerie.Statut.PLANIFIE, LotLancementSerie.Statut.EN_COURS]
        ).count(),
        'par_statut': [
            {'statut': r['statut_prod'], 'n': r['n'], 'quantite': r['q'] or 0}
            for r in LotLancementSerie.objects.filter(date_lancement__year=annee)
            .order_by().values('statut_prod').annotate(n=Count('pk'), q=Sum('quantite_lancee'))
        ],
    }


def section_recouvrement():
    montant = LigneRecouvrement.objects.filter(
        recouvrement__statut_dossier__in=ACTIFS
    ).aggregate(t=Sum('montant_a_recouvrer'))['t']
    return {
        'montant_actif': f(montant),
        'par_statut': [
            {'statut': r['statut_dossier'], 'n': r['n']}
            for r in Recouvrement.objects.order_by().values('statut_dossier').annotate(n=Count('pk'))
        ],
        'par_niveau': [
            {'niveau': r['niveau_relance'], 'n': r['n']}
            for r in Recouvrement.objects.filter(statut_dossier__in=ACTIFS)
            .order_by('niveau_relance').values('niveau_relance').annotate(n=Count('pk'))
        ],
    }


def section_caisses():
    tot = Caisse.objects.aggregate(t=Sum('solde_actuel'), n=Count('pk'))
    return {'total': f(tot['t']), 'nb': tot['n']}


# -------------------------------------------------------------------- Vue
class TableauDeBordView(APIView):
    """Chaque section n'est calculée que si l'utilisateur peut consulter le module concerné."""
    permission_classes = [HasPrivilege]
    privilege_map = {'get': 'statistiques.view'}

    def get(self, request):
        user = request.user
        courante = timezone.localdate().year
        try:
            annee = int(request.query_params.get('annee', courante))
        except ValueError:
            raise ValidationError({'annee': "Année invalide."})
        if not 2000 <= annee <= 2100:
            raise ValidationError({'annee': "L'année doit être comprise entre 2000 et 2100."})

        premiere = Facture.objects.aggregate(m=Min('date_facture'))['m']
        debut = timezone.localtime(premiere).year if premiere else courante
        annees = list(range(max(courante, annee), min(debut, courante, annee) - 1, -1))

        def si(privilege, calcul):
            return calcul() if user.has_privilege(privilege) else None

        return Response({
            'annee': annee,
            'annees': annees,
            'ventes': si('facture.view', lambda: section_ventes(annee)),
            'encaissements': si('reglement.view', lambda: section_encaissements(annee)),
            'creances': si('facture.view', section_creances),
            'commandes': si('commande.view', lambda: section_commandes(annee)),
            'budget': si('budget.view', lambda: section_budget(annee)),
            'stock': si('stock.view', section_stock),
            'production': si('lot.view', lambda: section_production(annee)),
            'recouvrement': si('recouvrement.view', section_recouvrement),
            'caisses': si('caisse.view', section_caisses),
        })