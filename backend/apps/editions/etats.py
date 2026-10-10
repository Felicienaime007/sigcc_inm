"""États financiers de synthèse : journal des ventes, balance âgée, encaissements.

Chaque état accepte `?export=json|csv|xlsx|pdf` (défaut : json) et les filtres
`?du=AAAA-MM-JJ&au=AAAA-MM-JJ&client=<id>`. La visibilité par type de client
est la même que sur les écrans (rôles).
"""
import csv
import io
from datetime import datetime
from decimal import Decimal

from django.db.models import Sum
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.views import APIView

from apps.authentification.permissions import HasPrivilege
from apps.commercial.models import Facture
from apps.commercial.views_aval import visibles
from apps.recouvrement.services import jours_retard
from apps.tresorerie.models import Reglement
from apps.tresorerie.services import net_a_payer, total_avoirs_ttc, total_regle

from . import documents as docs

ZERO = Decimal('0')
FORMATS = ('json', 'csv', 'xlsx', 'pdf')


def _periode(params):
    """(du, au) en dates, défaut : année en cours jusqu'à aujourd'hui."""
    auj = timezone.localdate()
    try:
        du = datetime.strptime(params.get('du'), '%Y-%m-%d').date() if params.get('du') else auj.replace(month=1, day=1)
    except ValueError:
        du = auj.replace(month=1, day=1)
    try:
        au = datetime.strptime(params.get('au'), '%Y-%m-%d').date() if params.get('au') else auj
    except ValueError:
        au = auj
    return du, au


def _fmt(montant):
    return f"{montant:,.2f}".replace(',', ' ').replace('.', ',')


class EtatBase(APIView):
    permission_classes = [HasPrivilege]
    privilege_map = {'get': 'etat.view'}
    titre = "État"
    nom_fichier = "etat"

    def lignes(self, request, du, au):
        raise NotImplementedError

    def entetes(self):
        raise NotImplementedError

    def ranger(self, ligne):
        raise NotImplementedError

    def totaliser(self, lignes):
        return None

    def get(self, request):
        from rest_framework.response import Response
        du, au = _periode(request.query_params)
        lignes = self.lignes(request, du, au)
        format_demande = (request.query_params.get('export') or 'json').lower()
        if format_demande not in FORMATS:
            format_demande = 'json'
        if format_demande == 'json':
            return Response({
                'titre': self.titre, 'du': str(du), 'au': str(au),
                'lignes': [self.ranger(l) for l in lignes],
                'total': self.totaliser(lignes),
            })
        if format_demande == 'csv':
            return self._csv(lignes, du, au)
        if format_demande == 'xlsx':
            return self._xlsx(lignes, du, au)
        return self._pdf(lignes, du, au, request.user)

    # ------------------------------------------------------------- rendus
    def _csv(self, lignes, du, au):
        tampon = io.StringIO()
        tampon.write('﻿')  # BOM : Excel ouvre directement en UTF-8
        ecrivain = csv.writer(tampon, delimiter=';')
        ecrivain.writerow([self.titre, f"du {du} au {au}"])
        ecrivain.writerow(self.entetes())
        for l in lignes:
            ecrivain.writerow([str(v) for v in self.ranger(l).values()])
        total = self.totaliser(lignes)
        if total:
            ecrivain.writerow([])
            ecrivain.writerow([f"{k} : {v}" for k, v in total.items()])
        reponse = HttpResponse(tampon.getvalue(), content_type='text/csv; charset=utf-8')
        reponse['Content-Disposition'] = f'attachment; filename="{self.nom_fichier}-{au}.csv"'
        return reponse

    def _xlsx(self, lignes, du, au):
        from openpyxl import Workbook
        from openpyxl.styles import Alignment, Font
        classeur = Workbook()
        feuille = classeur.active
        feuille.title = self.titre[:31]
        feuille.append([f"{self.titre} — du {du} au {au}"])
        feuille['A1'].font = Font(bold=True, size=13)
        feuille.append(list(self.entetes()))
        for cellule in feuille[2]:
            cellule.font = Font(bold=True)
        for l in lignes:
            feuille.append(list(self.ranger(l).values()))
        total = self.totaliser(lignes)
        if total:
            feuille.append([])
            for k, v in total.items():
                feuille.append([k, v])
        for colonne in feuille.columns:
            largeur = max((len(str(c.value or '')) for c in colonne), default=10)
            feuille.column_dimensions[colonne[0].column_letter].width = min(largeur + 2, 45)
        for rangee in feuille.iter_rows():
            for cellule in rangee:
                cellule.alignment = Alignment(vertical='top', wrap_text=True)
        tampon = io.BytesIO()
        classeur.save(tampon)
        reponse = HttpResponse(
            tampon.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        reponse['Content-Disposition'] = f'attachment; filename="{self.nom_fichier}-{au}.xlsx"'
        return reponse

    def _pdf(self, lignes, du, au, user):
        corps = [
            *docs.entete(),
            *docs.titre_doc(f"{self.titre} — du {du} au {au}"),
            docs.tableau(
                self.entetes(),
                [[str(v) for v in self.ranger(l).values()] for l in lignes],
                [1] * len(self.entetes()),
            ),
        ]
        total = self.totaliser(lignes)
        if total:
            corps += [docs.totaux([(k, str(v), True) for k, v in total.items()])]
        contenu = docs.construire(corps, self.titre, user)
        reponse = HttpResponse(contenu, content_type='application/pdf')
        reponse['Content-Disposition'] = f'inline; filename="{self.nom_fichier}-{au}.pdf"'
        reponse['Cache-Control'] = 'no-store'
        return reponse


# ------------------------------------------------------- journal des ventes
class JournalVentesView(EtatBase):
    titre = "Journal des ventes"
    nom_fichier = "journal-ventes"

    COLONNES = ['Facture', 'Date', 'Client', 'HT', 'TVA', 'TTC',
                'Avoirs TTC', 'Net à payer', 'Réglé', 'Reste', 'Statut']

    def entetes(self):
        return self.COLONNES

    def lignes(self, request, du, au):
        qs = Facture.objects.select_related(
            'commande__client', 'client'
        ).filter(date_facture__date__gte=du, date_facture__date__lte=au)
        qs = visibles(qs, request.user, 'commande__client', 'client')
        client = request.query_params.get('client')
        if client:
            from django.db.models import Q
            qs = qs.filter(Q(client_id=client) | Q(commande__client_id=client))
        return list(qs.order_by('date_facture', 'num_facture'))

    def ranger(self, f):
        ttc = f.montant_ht + f.tva
        avoirs = total_avoirs_ttc(f)
        regle = total_regle(f)
        return {
            'facture': f.num_facture,
            'date': f.date_facture.date().isoformat(),
            'client': f.client_facture.nom_client,
            'ht': _fmt(f.montant_ht), 'tva': _fmt(f.tva), 'ttc': _fmt(ttc),
            'avoirs': _fmt(avoirs), 'net': _fmt(ttc - avoirs),
            'regle': _fmt(regle), 'reste': _fmt(ttc - avoirs - regle),
            'statut': f.get_statut_paiement_display(),
        }

    def totaliser(self, lignes):
        tot = {'ht': ZERO, 'tva': ZERO, 'avoirs': ZERO, 'regle': ZERO, 'reste': ZERO}
        for f in lignes:
            avoirs = total_avoirs_ttc(f)
            regle = total_regle(f)
            tot['ht'] += f.montant_ht
            tot['tva'] += f.tva
            tot['avoirs'] += avoirs
            tot['regle'] += regle
            tot['reste'] += f.montant_ht + f.tva - avoirs - regle
        return {
            'Total HT': _fmt(tot['ht']), 'Total TVA': _fmt(tot['tva']),
            'Total avoirs TTC': _fmt(tot['avoirs']), 'Total réglé': _fmt(tot['regle']),
            'Total reste': _fmt(tot['reste']),
        }


# ----------------------------------------------------------- balance âgée
class BalanceAgeeView(EtatBase):
    titre = "Balance âgée"
    nom_fichier = "balance-agee"

    COLONNES = ['Client', 'Nb factures', 'Total dû', 'Non échues',
                '1-30 j', '31-60 j', '61-90 j', '+90 j']

    def entetes(self):
        return self.COLONNES

    def lignes(self, request, du, au):
        qs = Facture.objects.select_related(
            'commande__client', 'client'
        ).filter(
            date_facture__date__lte=au,
            statut_paiement__in=[Facture.StatutPaiement.NON_PAYEE,
                                 Facture.StatutPaiement.PARTIELLE],
        )
        qs = visibles(qs, request.user, 'commande__client', 'client')
        client = request.query_params.get('client')
        if client:
            from django.db.models import Q
            qs = qs.filter(Q(client_id=client) | Q(commande__client_id=client))
        par_client = {}
        for f in qs:
            reste = net_a_payer(f) - total_regle(f)
            if reste <= 0:
                continue
            retard = jours_retard(f)
            idx = 0 if retard == 0 else 1 if retard <= 30 else 2 if retard <= 60 else 3 if retard <= 90 else 4
            c = f.client_facture
            entree = par_client.setdefault(
                c.pk, {'client': c.nom_client, 'n': 0,
                       'tranches': [ZERO, ZERO, ZERO, ZERO, ZERO]})
            entree['n'] += 1
            entree['tranches'][idx] += reste
        return sorted(par_client.values(), key=lambda e: sum(e['tranches']), reverse=True)

    def ranger(self, e):
        total = sum(e['tranches'], ZERO)
        return {
            'client': e['client'], 'n': e['n'], 'total': _fmt(total),
            't0': _fmt(e['tranches'][0]), 't30': _fmt(e['tranches'][1]),
            't60': _fmt(e['tranches'][2]), 't90': _fmt(e['tranches'][3]),
            't90p': _fmt(e['tranches'][4]),
        }

    def totaliser(self, lignes):
        tot = [ZERO, ZERO, ZERO, ZERO, ZERO]
        n = 0
        for e in lignes:
            n += e['n']
            for i in range(5):
                tot[i] += e['tranches'][i]
        return {
            'Factures': n, 'Total dû': _fmt(sum(tot, ZERO)),
            'Non échues': _fmt(tot[0]), '1-30 j': _fmt(tot[1]),
            '31-60 j': _fmt(tot[2]), '61-90 j': _fmt(tot[3]), '+90 j': _fmt(tot[4]),
        }


# ----------------------------------------------------- état des encaissements
class EncaissementsView(EtatBase):
    titre = "État des encaissements"
    nom_fichier = "encaissements"

    COLONNES = ['Date', 'Mode', 'Facture', 'Client', 'Montant', 'Quittance', 'Statut']

    def entetes(self):
        return self.COLONNES

    def lignes(self, request, du, au):
        qs = Reglement.objects.select_related(
            'facture__commande__client', 'facture__client',
            'quittance__livre', 'quittance__caisse',
        ).filter(date_reglement__date__gte=du, date_reglement__date__lte=au)
        qs = visibles(qs, request.user,
                      'facture__commande__client', 'facture__client')
        mode = request.query_params.get('mode')
        if mode:
            qs = qs.filter(mode_reglement=mode)
        client = request.query_params.get('client')
        if client:
            from django.db.models import Q
            qs = qs.filter(Q(facture__client_id=client)
                           | Q(facture__commande__client_id=client))
        return list(qs.order_by('date_reglement', 'pk'))

    def ranger(self, r):
        q = getattr(r, 'quittance', None)
        return {
            'date': r.date_reglement.date().isoformat(),
            'mode': r.get_mode_reglement_display(),
            'facture': r.facture.num_facture,
            'client': r.facture.client_facture.nom_client,
            'montant': _fmt(r.montant_regle),
            'quittance': (f"{q.livre.numero_livre}/{q.num_feuille}{q.attribut_volet}"
                          if q is not None else (r.num_virement_tresor or '—')),
            'statut': r.get_statut_display(),
        }

    def totaliser(self, lignes):
        tot = ZERO
        par_mode = {}
        for r in lignes:
            if r.statut != Reglement.Statut.ACTIF:
                continue
            tot += r.montant_regle
            par_mode[r.get_mode_reglement_display()] = (
                par_mode.get(r.get_mode_reglement_display(), ZERO) + r.montant_regle
            )
        resume = {'Total encaissé (actifs)': _fmt(tot)}
        resume.update({f"Dont {m}": _fmt(v) for m, v in par_mode.items()})
        return resume
