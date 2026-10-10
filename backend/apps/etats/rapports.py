"""
États financiers de gestion. Chaque fonction renvoie un dictionnaire commun :
colonnes, lignes, totaux (par clé de colonne), synthèse, nom de fichier.
"""
from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Callable

from django.conf import settings
from django.db.models import DecimalField, OuterRef, Q, Subquery, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.budget.models import Budget, EngagementBudget, LigneBudgetaire
from apps.clients.permissions import types_visibles
from apps.commercial.models import Facture, LigneAvoir
from apps.recouvrement.services import jours_retard
from apps.tresorerie.models import Caisse, LivreCaisse, Reglement

ZERO = Decimal('0')
CENT = Decimal('0.01')
MONEY = DecimalField(max_digits=20, decimal_places=2)

LIMITE = 50_000          # lignes maximum d'un état
APERCU = 500             # lignes renvoyées à l'écran
PERIODE_MAX_JOURS = 1100

TYPES_CLIENT = {
    'MINISTERE': 'Ministère (SOA)', 'CTD': 'Collectivité (SOA)',
    'PRIVE': 'Client privé', 'SIMPLE': 'Client du comptoir',
}


# ----------------------------------------------------------------- Outils
def fmt(d):
    return d.strftime('%d/%m/%Y')


def parse_date(valeur, cle):
    if not valeur:
        return None
    try:
        return date.fromisoformat(valeur)
    except ValueError:
        raise ValidationError({cle: "Date invalide (format AAAA-MM-JJ)."})


def periode(params):
    aujourdhui = timezone.localdate()
    du = parse_date(params.get('du'), 'du') or aujourdhui.replace(day=1)
    au = parse_date(params.get('au'), 'au') or aujourdhui
    if du > au:
        raise ValidationError({'du': "La date de début doit précéder la date de fin."})
    if (au - du).days > PERIODE_MAX_JOURS:
        raise ValidationError({'au': "Période trop longue (3 ans maximum)."})
    return du, au


def entier(params, cle):
    v = params.get(cle)
    if not v:
        return None
    try:
        return int(v)
    except ValueError:
        raise ValidationError({cle: "Valeur invalide."})


def choix(params, cle, valides):
    v = params.get(cle) or None
    if v and v not in valides:
        raise ValidationError({cle: "Valeur invalide."})
    return v


def restreindre(qs, user, chemins, type_demande=None):
    """Ne garde que les clients d'un type que l'utilisateur a le droit de voir."""
    types = {getattr(t, 'value', t) for t in types_visibles(user)}
    if type_demande:
        types &= {type_demande}
    q = Q()
    for chemin in chemins:
        q |= Q(**{f'{chemin}__type_client__in': list(types)})
    return qs.filter(q)


def charger(qs):
    lignes = list(qs[:LIMITE + 1])
    if len(lignes) > LIMITE:
        raise ValidationError({
            'detail': f"Plus de {LIMITE} lignes : réduisez la période ou ajoutez des filtres."
        })
    return lignes


def col(cle, label, type_='texte', poids=1.0):
    return {'cle': cle, 'label': label, 'type': type_, 'poids': poids}


def resultat(code, titre, sous_titre, colonnes, lignes, totaux, synthese=None, fichier=None):
    return {
        'code': code, 'titre': titre, 'sous_titre': sous_titre, 'colonnes': colonnes,
        'lignes': lignes, 'totaux': totaux, 'synthese': synthese or [], 'fichier': fichier or code,
    }


def _taux():
    return getattr(settings, 'TVA_TAUX', Decimal('0.20'))


def _ttc_avoir(ht):
    return ht + (ht * _taux()).quantize(CENT, rounding=ROUND_HALF_UP)


def _avoirs_ht():
    return Coalesce(
        Subquery(
            LigneAvoir.objects.filter(avoir__facture=OuterRef('pk')).order_by()
            .values('avoir__facture').annotate(t=Sum('montant_avoir')).values('t'),
            output_field=MONEY,
        ),
        Value(ZERO), output_field=MONEY,
    )


def _regle():
    return Coalesce(
        Subquery(
            Reglement.objects.filter(facture=OuterRef('pk')).order_by()
            .values('facture').annotate(t=Sum('montant_regle')).values('t'),
            output_field=MONEY,
        ),
        Value(ZERO), output_field=MONEY,
    )


# ------------------------------------------------------- Journal des ventes
def etat_ventes(user, params):
    du, au = periode(params)
    type_demande = choix(params, 'type_client', set(TYPES_CLIENT))
    statut = choix(params, 'statut', {s.value for s in Facture.StatutPaiement})
    mode = choix(params, 'mode', {m.value for m in Facture.TypeFacturation})

    qs = Facture.objects.filter(date_facture__date__gte=du, date_facture__date__lte=au)
    qs = restreindre(qs, user, ('commande__client', 'client'), type_demande)
    if statut:
        qs = qs.filter(statut_paiement=statut)
    if mode:
        qs = qs.filter(type_facturation=mode)
    qs = qs.select_related('commande__client', 'client').annotate(avoir_ht=_avoirs_ht()).order_by('date_facture', 'pk')

    lignes = []
    tot = {k: ZERO for k in ('ht', 'tva', 'ttc', 'avoirs', 'net')}
    par_type = defaultdict(lambda: [0, ZERO])
    for f in charger(qs):
        client = f.client_facture
        ttc = f.montant_ht + f.tva
        avoirs = _ttc_avoir(f.avoir_ht)
        net = ttc - avoirs
        lignes.append({
            'date': timezone.localtime(f.date_facture).date(),
            'numero': f.num_facture,
            'client': client.nom_client,
            'type': TYPES_CLIENT.get(client.type_client, client.type_client),
            'origine': f"Commande {f.commande.num_commande}" if f.commande_id else "Comptoir",
            'mode': f.get_type_facturation_display(),
            'ht': f.montant_ht, 'tva': f.tva, 'ttc': ttc, 'avoirs': avoirs, 'net': net,
            'statut': f.get_statut_paiement_display(),
        })
        for k, v in (('ht', f.montant_ht), ('tva', f.tva), ('ttc', ttc), ('avoirs', avoirs), ('net', net)):
            tot[k] += v
        par_type[client.type_client][0] += 1
        par_type[client.type_client][1] += net

    synthese = [
        {'label': TYPES_CLIENT.get(t, t), 'nombre': v[0], 'montant': v[1]}
        for t, v in sorted(par_type.items(), key=lambda kv: kv[1][1], reverse=True)
    ]
    return resultat(
        'ventes', "Journal des ventes",
        f"Factures émises du {fmt(du)} au {fmt(au)} — montants en Ariary (net = TTC moins avoirs émis à ce jour)",
        [col('date', "Date", 'date', 1.2), col('numero', "N° facture", 'texte', 1.7),
         col('client', "Client", 'texte', 3.0), col('type', "Type", 'texte', 1.8),
         col('origine', "Origine", 'texte', 1.9), col('mode', "Mode", 'texte', 1.9),
         col('ht', "Total HT", 'montant', 1.6), col('tva', "TVA", 'montant', 1.4),
         col('ttc', "Total TTC", 'montant', 1.6), col('avoirs', "Avoirs TTC", 'montant', 1.4),
         col('net', "Net TTC", 'montant', 1.6), col('statut', "Paiement", 'texte', 1.7)],
        lignes, tot, synthese, f"journal-ventes_{du}_{au}",
    )


# --------------------------------------------------- État des encaissements
def etat_encaissements(user, params):
    du, au = periode(params)
    mode = choix(params, 'mode', {m.value for m in Reglement.Mode})
    caisse_id = entier(params, 'caisse')

    qs = Reglement.objects.filter(date_reglement__date__gte=du, date_reglement__date__lte=au)
    qs = restreindre(qs, user, ('facture__commande__client', 'facture__client'))
    if mode:
        qs = qs.filter(mode_reglement=mode)
    if caisse_id:
        qs = qs.filter(quittance__caisse_id=caisse_id)
    qs = qs.select_related(
        'facture__commande__client', 'facture__client', 'quittance__livre', 'quittance__caisse'
    ).order_by('date_reglement', 'pk')

    lignes, total = [], ZERO
    par_mode = defaultdict(lambda: [0, ZERO])
    for r in charger(qs):
        client = r.facture.client_facture
        q = getattr(r, 'quittance', None)
        lignes.append({
            'date': r.date_reglement,
            'facture': r.facture.num_facture,
            'client': client.nom_client,
            'type': TYPES_CLIENT.get(client.type_client, client.type_client),
            'mode': r.get_mode_reglement_display(),
            'reference': (f"{q.livre.numero_livre} / feuille {q.num_feuille} / volet {q.attribut_volet}"
                          if q else (r.num_virement_tresor or '')),
            'caisse': q.caisse.code_caisse if q else '',
            'montant': r.montant_regle,
        })
        total += r.montant_regle
        par_mode[r.mode_reglement][0] += 1
        par_mode[r.mode_reglement][1] += r.montant_regle

    synthese = [
        {'label': Reglement.Mode(m).label, 'nombre': v[0], 'montant': v[1]}
        for m, v in sorted(par_mode.items(), key=lambda kv: kv[1][1], reverse=True)
    ]
    return resultat(
        'encaissements', "État des encaissements",
        f"Règlements enregistrés du {fmt(du)} au {fmt(au)} — montants en Ariary",
        [col('date', "Date", 'datetime', 1.7), col('facture', "N° facture", 'texte', 1.7),
         col('client', "Client", 'texte', 3.0), col('type', "Type", 'texte', 1.8),
         col('mode', "Mode", 'texte', 1.6), col('reference', "Quittance / virement", 'texte', 3.4),
         col('caisse', "Caisse", 'texte', 1.3), col('montant', "Montant", 'montant', 1.7)],
        lignes, {'montant': total}, synthese, f"encaissements_{du}_{au}",
    )


# ---------------------------------------------------- Balance âgée des créances
TRANCHES = [('t0', "Non échu"), ('t30', "1 à 30 j"), ('t60', "31 à 60 j"),
            ('t90', "61 à 90 j"), ('t90p', "Plus de 90 j")]


def etat_balance_agee(user, params):
    type_demande = choix(params, 'type_client', set(TYPES_CLIENT))
    client_id = entier(params, 'client')
    aujourdhui = timezone.localdate()

    qs = Facture.objects.filter(
        statut_paiement__in=[Facture.StatutPaiement.NON_PAYEE, Facture.StatutPaiement.PARTIELLE]
    )
    qs = restreindre(qs, user, ('commande__client', 'client'), type_demande)
    if client_id:
        qs = qs.filter(Q(client_id=client_id) | Q(commande__client_id=client_id))
    qs = qs.select_related('commande__client', 'client').annotate(regle=_regle(), avoir_ht=_avoirs_ht())

    groupes = {}
    for f in charger(qs):
        reste = f.montant_ht + f.tva - _ttc_avoir(f.avoir_ht) - f.regle
        if reste <= 0:
            continue
        client = f.client_facture
        g = groupes.setdefault(client.pk, {
            'client': client.nom_client, 'type': TYPES_CLIENT.get(client.type_client, client.type_client),
            'nb': 0, 'total': ZERO, **{cle: ZERO for cle, _ in TRANCHES},
        })
        retard = jours_retard(f)
        cle = 't0' if retard == 0 else 't30' if retard <= 30 else 't60' if retard <= 60 else 't90' if retard <= 90 else 't90p'
        g[cle] += reste
        g['total'] += reste
        g['nb'] += 1

    lignes = sorted(groupes.values(), key=lambda g: g['total'], reverse=True)
    tot = {'nb': sum(g['nb'] for g in lignes), 'total': sum((g['total'] for g in lignes), ZERO)}
    for cle, _ in TRANCHES:
        tot[cle] = sum((g[cle] for g in lignes), ZERO)

    synthese = [
        {'label': "Total des créances", 'nombre': tot['nb'], 'montant': tot['total']},
        {'label': "dont échues (en retard)", 'nombre': None, 'montant': tot['total'] - tot['t0']},
    ]
    return resultat(
        'balance-agee', "Balance âgée des créances",
        f"Situation au {fmt(aujourdhui)} — reste dû TTC (règlements et avoirs déduits), par ancienneté de l'échéance",
        [col('client', "Client", 'texte', 3.2), col('type', "Type", 'texte', 1.9),
         col('nb', "Factures", 'nombre', 1.0),
         *[col(cle, label, 'montant', 1.7) for cle, label in TRANCHES],
         col('total', "Total dû", 'montant', 1.9)],
        lignes, tot, synthese, f"balance-agee_{aujourdhui}",
    )


# ------------------------------------------------------------ État de caisse
def etat_caisse(user, params):
    du, au = periode(params)
    caisse_id = entier(params, 'caisse')
    caisses = Caisse.objects.order_by('code_caisse')
    if caisse_id:
        caisses = caisses.filter(pk=caisse_id)
    caisses = list(caisses)
    if not caisses:
        raise ValidationError({'caisse': "Caisse introuvable."})

    ENTREE, SORTIE = LivreCaisse.Type.ENTREE, LivreCaisse.Type.SORTIE
    # Solde d'ouverture = solde actuel moins l'effet des opérations depuis le début de la période
    ouvertures = {}
    for c in caisses:
        a = LivreCaisse.objects.filter(caisse=c, date_operation__date__gte=du).aggregate(
            e=Sum('montant_op', filter=Q(type_operation=ENTREE)),
            s=Sum('montant_op', filter=Q(type_operation=SORTIE)),
        )
        ouvertures[c.pk] = c.solde_actuel - ((a['e'] or ZERO) - (a['s'] or ZERO))

    ops = charger(
        LivreCaisse.objects.filter(
            caisse__in=caisses, date_operation__date__gte=du, date_operation__date__lte=au
        ).select_related('caisse', 'reglement__facture').order_by('date_operation', 'pk')
    )
    soldes = dict(ouvertures)
    lignes, entrees, sorties, n_e, n_s = [], ZERO, ZERO, 0, 0
    for o in ops:
        est_entree = o.type_operation == ENTREE
        soldes[o.caisse_id] += o.montant_op if est_entree else -o.montant_op
        if est_entree:
            entrees += o.montant_op
            n_e += 1
        else:
            sorties += o.montant_op
            n_s += 1
        lignes.append({
            'date': o.date_operation, 'caisse': o.caisse.code_caisse,
            'libelle': (f"Encaissement {o.reglement.facture.num_facture}" if o.reglement_id else (o.reference or '')),
            'entree': o.montant_op if est_entree else None,
            'sortie': None if est_entree else o.montant_op,
            'solde': soldes[o.caisse_id],
        })

    ouverture = sum(ouvertures.values(), ZERO)
    synthese = [
        {'label': "Solde d'ouverture", 'nombre': None, 'montant': ouverture},
        {'label': "Entrées de la période", 'nombre': n_e, 'montant': entrees},
        {'label': "Sorties de la période", 'nombre': n_s, 'montant': sorties},
        {'label': "Solde de clôture", 'nombre': None, 'montant': ouverture + entrees - sorties},
    ]
    nom = caisses[0].code_caisse if len(caisses) == 1 else 'toutes-caisses'
    return resultat(
        'caisse', "État de caisse",
        f"{'Caisse ' + caisses[0].code_caisse if len(caisses) == 1 else 'Toutes les caisses'} "
        f"— du {fmt(du)} au {fmt(au)} — montants en Ariary",
        [col('date', "Date", 'datetime', 1.7), col('caisse', "Caisse", 'texte', 1.3),
         col('libelle', "Libellé", 'texte', 4.2), col('entree', "Entrée", 'montant', 1.7),
         col('sortie', "Sortie", 'montant', 1.7), col('solde', "Solde de la caisse", 'montant', 1.9)],
        lignes, {'entree': entrees, 'sortie': sorties}, synthese, f"etat-caisse_{nom}_{du}_{au}",
    )


# ----------------------------------------------------- Situation budgétaire
def etat_budget(user, params):
    annee = entier(params, 'annee') or timezone.localdate().year
    if not 2000 <= annee <= 2100:
        raise ValidationError({'annee': "Année invalide."})
    organisme_id = entier(params, 'organisme')

    qs = LigneBudgetaire.objects.filter(budget__annee_budgetaire=annee)
    if organisme_id:
        qs = qs.filter(budget__organisme_id=organisme_id)
    qs = qs.select_related('budget__organisme', 'type_financement').annotate(
        vise=Coalesce(
            Sum('engagements__montant_engage',
                filter=Q(engagements__statut_engagement=EngagementBudget.Statut.VISE)),
            Value(ZERO), output_field=MONEY),
        consomme=Coalesce(
            Sum('engagements__montant_engage',
                filter=Q(engagements__statut_engagement=EngagementBudget.Statut.SOLDE)),
            Value(ZERO), output_field=MONEY),
    ).order_by('budget__organisme__nom_organisme', 'code_article')

    def taux(engage, dotation):
        return (engage / dotation * 100).quantize(Decimal('0.1'), rounding=ROUND_HALF_UP) if dotation else ZERO

    lignes, tot = [], {k: ZERO for k in ('dotation', 'vise', 'consomme', 'dispo')}
    for l in charger(qs):
        dotation = l.montant_disponible + l.vise + l.consomme
        lignes.append({
            'organisme': l.budget.organisme.nom_organisme, 'article': l.code_article,
            'libelle': l.libelle_ligne,
            'financement': l.type_financement.libelle_financement if l.type_financement_id else '',
            'dotation': dotation, 'vise': l.vise, 'consomme': l.consomme,
            'dispo': l.montant_disponible, 'taux': taux(l.vise + l.consomme, dotation),
        })
        tot['dotation'] += dotation
        tot['vise'] += l.vise
        tot['consomme'] += l.consomme
        tot['dispo'] += l.montant_disponible
    tot['taux'] = taux(tot['vise'] + tot['consomme'], tot['dotation'])

    budgets = Budget.objects.filter(annee_budgetaire=annee)
    if organisme_id:
        budgets = budgets.filter(organisme_id=organisme_id)
    alloue = budgets.aggregate(t=Sum('montant_alloue'))['t'] or ZERO
    synthese = [
        {'label': "Montant alloué des budgets", 'nombre': budgets.count(), 'montant': alloue},
        {'label': "Dotation des lignes", 'nombre': len(lignes), 'montant': tot['dotation']},
    ]
    return resultat(
        'budget', f"Situation budgétaire {annee}",
        f"Exercice {annee} — engagé en cours = visé par le CF ; consommé = engagement soldé par une commande",
        [col('organisme', "Organisme", 'texte', 2.8), col('article', "Article", 'texte', 1.0),
         col('libelle', "Libellé", 'texte', 3.0), col('financement', "Financement", 'texte', 2.0),
         col('dotation', "Dotation", 'montant', 1.8), col('vise', "Engagé en cours", 'montant', 1.8),
         col('consomme', "Consommé", 'montant', 1.8), col('dispo', "Disponible", 'montant', 1.8),
         col('taux', "Taux", 'pourcent', 1.0)],
        lignes, tot, synthese, f"situation-budgetaire_{annee}",
    )


# ----------------------------------------------------------------- Registre
@dataclass(frozen=True)
class Rapport:
    code: str
    titre: str
    privilege: str
    fonction: Callable


RAPPORTS = {
    r.code: r for r in [
        Rapport('ventes', "Journal des ventes", 'etat_ventes.view', etat_ventes),
        Rapport('encaissements', "État des encaissements", 'etat_encaissements.view', etat_encaissements),
        Rapport('balance-agee', "Balance âgée des créances", 'etat_creances.view', etat_balance_agee),
        Rapport('caisse', "État de caisse", 'etat_caisse.view', etat_caisse),
        Rapport('budget', "Situation budgétaire", 'etat_budget.view', etat_budget),
    ]
}