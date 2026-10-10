"""Briques communes des éditions PDF (ReportLab) : en-tête, tableaux, totaux, pied de page."""
import io
import os
from datetime import datetime
from decimal import Decimal
from xml.sax.saxutils import escape

from django.conf import settings
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    HRFlowable, Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

from .lettres import montant_en_lettres

NBSP = '\u00a0'
LARGEUR = A4[0] - 36 * mm            # largeur utile (marges de 18 mm)
MOITIE = LARGEUR / 2 - 3 * mm
BLEU = colors.HexColor('#1f3a5f')
GRIS = colors.HexColor('#6b7280')
CLAIR = colors.HexColor('#e5e7eb')

_base = getSampleStyleSheet()['Normal']


def _st(nom, **kw):
    params = dict(fontName='Helvetica', fontSize=9, leading=12, textColor=colors.black)
    params.update(kw)
    return ParagraphStyle(nom, parent=_base, **params)


S = {
    'normal': _st('normal'),
    'justify': _st('justify', alignment=TA_JUSTIFY, leading=14, spaceAfter=6),
    'droite': _st('droite', alignment=TA_RIGHT),
    'droite_gras': _st('droite_gras', alignment=TA_RIGHT, fontName='Helvetica-Bold'),
    'centre': _st('centre', alignment=TA_CENTER),
    'centre_gras': _st('centre_gras', alignment=TA_CENTER, fontName='Helvetica-Bold'),
    'gras': _st('gras', fontName='Helvetica-Bold'),
    'petit': _st('petit', fontSize=7.5, leading=9.5, textColor=GRIS),
    'inm': _st('inm', fontName='Helvetica-Bold', fontSize=11, leading=14, textColor=BLEU),
    'titre': _st('titre', fontName='Helvetica-Bold', fontSize=16, leading=20, alignment=TA_CENTER, textColor=BLEU),
    'numero': _st('numero', fontName='Helvetica-Bold', fontSize=11, leading=14, alignment=TA_CENTER),
    'etiquette': _st('etiquette', fontName='Helvetica-Bold', fontSize=7.5, textColor=GRIS),
    'th': _st('th', fontName='Helvetica-Bold', fontSize=8.5, textColor=colors.white),
    'th_d': _st('th_d', fontName='Helvetica-Bold', fontSize=8.5, textColor=colors.white, alignment=TA_RIGHT),
    'cell': _st('cell', fontSize=8.5, leading=11),
    'cell_d': _st('cell_d', fontSize=8.5, leading=11, alignment=TA_RIGHT),
    'alerte': _st('alerte', fontName='Helvetica-Bold', textColor=colors.HexColor('#b91c1c'), alignment=TA_CENTER),
    'ok': _st('ok', fontName='Helvetica-Bold', fontSize=11, textColor=colors.HexColor('#15803d'), alignment=TA_CENTER),
}


# ------------------------------------------------------------------ Texte
def sur(valeur):
    """Texte compatible avec la police standard (WinAnsi) : les caractères inconnus deviennent « ? »."""
    s = '' if valeur is None else str(valeur)
    s = s.replace('\u202f', ' ').replace('\u2009', ' ')
    return s.encode('cp1252', 'replace').decode('cp1252')


def esc(valeur):
    return escape(sur(valeur))


def kv(label, valeur):
    return f"<b>{esc(label)} :</b> {esc(valeur)}"


def P(texte, st='normal', brut=False):
    """Paragraphe. brut=True : le texte contient déjà du balisage (valeurs échappées avec esc())."""
    contenu = sur(texte) if brut else escape(sur(texte))
    return Paragraph(contenu.replace('\n', '<br/>'), S[st])


# ------------------------------------------------------------- Formats
def nombre(v):
    n = Decimal(str(v))
    return f"{int(n):,}".replace(',', NBSP)


def ar(v):
    if v is None or v == '':
        return '—'
    n = Decimal(str(v))
    if n == n.to_integral_value():
        texte = f"{int(n):,}".replace(',', NBSP)
    else:
        texte = f"{n:,.2f}".replace(',', NBSP).replace('.', ',')
    return f"{texte}{NBSP}Ar"


def fmt_date(v):
    if v is None:
        return '—'
    if isinstance(v, datetime):
        if timezone.is_aware(v):
            v = timezone.localtime(v)
        v = v.date()
    return v.strftime('%d/%m/%Y')


def fmt_dt(v):
    if timezone.is_aware(v):
        v = timezone.localtime(v)
    return v.strftime('%d/%m/%Y à %H:%M')


# ---------------------------------------------------------------- Blocs
def config():
    base = {'nom': "IMPRIMERIE NATIONALE DE MADAGASCAR", 'adresse': '', 'contact': '',
            'identifiants': '', 'logo': None}
    base.update(getattr(settings, 'INM_ENTETE', {}))
    return base


def _sans_marge(t, extra=()):
    t.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0), ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        *extra,
    ]))
    return t


def entete(largeur=None):
    """En-tête avec le logo de l'imprimerie. `largeur` : largeur utile (paysage pour les états)."""
    cfg = config()
    usable = largeur if largeur else LARGEUR
    gauche = [
        P("RÉPUBLIQUE DE MADAGASCAR", 'gras'),
        P("Fitiavana – Tanindrazana – Fandrosoana", 'petit'),
        Spacer(1, 4),
        P(cfg['nom'], 'inm'),
    ]
    for cle in ('adresse', 'contact', 'identifiants'):
        if cfg.get(cle):
            gauche.append(P(cfg[cle], 'petit'))

    logo = cfg.get('logo')
    if logo and os.path.exists(str(logo)):
        bloc = _sans_marge(
            Table([[gauche, Image(str(logo), width=32 * mm, height=20 * mm, kind='proportional')]],
                  colWidths=[usable - 38 * mm, 38 * mm]),
            [('ALIGN', (1, 0), (1, 0), 'RIGHT'), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE')],
        )
    else:
        bloc = _sans_marge(Table([[gauche]], colWidths=[usable]))
    return [bloc, HRFlowable(width='100%', thickness=1.2, color=BLEU, spaceBefore=6, spaceAfter=10)]


def titre_doc(titre, numero=None):
    elements = [P(titre, 'titre')]
    if numero:
        elements.append(P(f"N° {numero}", 'numero'))
    elements.append(Spacer(1, 10))
    return elements


def encadre(titre, lignes, largeur=MOITIE):
    """Cadre « étiquette + lignes ». `lignes` : texte déjà échappé (utiliser kv() ou esc())."""
    t = Table([[P(titre.upper(), 'etiquette')], [P('<br/>'.join(lignes), 'normal', brut=True)]],
              colWidths=[largeur])
    t.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.6, CLAIR),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f3f4f6')),
        ('LEFTPADDING', (0, 0), (-1, -1), 7), ('RIGHTPADDING', (0, 0), (-1, -1), 7),
        ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    return t


def deux_colonnes(gauche, droite):
    return _sans_marge(Table([[gauche, '', droite]], colWidths=[MOITIE, 6 * mm, MOITIE]))


def tableau(entetes, lignes, poids, droite=()):
    """`droite` : indices des colonnes alignées à droite ; `poids` : largeurs relatives."""
    total = sum(poids)
    largeurs = [LARGEUR * p / total for p in poids]
    data = [[P(h, 'th_d' if i in droite else 'th') for i, h in enumerate(entetes)]]
    for ligne in lignes:
        data.append([P(c, 'cell_d' if i in droite else 'cell') for i, c in enumerate(ligne)])
    t = Table(data, colWidths=largeurs, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BLEU),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9fafb')]),
        ('LINEBELOW', (0, 1), (-1, -1), 0.4, CLAIR),
        ('BOX', (0, 0), (-1, -1), 0.6, CLAIR),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 5), ('RIGHTPADDING', (0, 0), (-1, -1), 5),
    ]))
    return t


def totaux(lignes):
    """(libellé, valeur) ou (libellé, valeur, True) pour une ligne en gras."""
    data, styles = [], []
    for i, l in enumerate(lignes):
        fort = len(l) > 2 and l[2]
        data.append([P(l[0], 'gras' if fort else 'normal'), P(l[1], 'droite_gras' if fort else 'droite')])
        if fort:
            styles += [('LINEABOVE', (0, i), (-1, i), 0.8, BLEU),
                       ('BACKGROUND', (0, i), (-1, i), colors.HexColor('#eef2f7'))]
    t = Table(data, colWidths=[52 * mm, 38 * mm], hAlign='RIGHT')
    t.setStyle(TableStyle([
        ('TOPPADDING', (0, 0), (-1, -1), 3), ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 5), ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        *styles,
    ]))
    return t


def phrase_lettres(prefixe, montant):
    return P(f"{esc(prefixe)} <b>{esc(montant_en_lettres(montant))}</b>.", 'justify', brut=True)


def signatures(gauche, droite, hauteur=20):
    return Table(
        [[[P(gauche, 'centre_gras'), Spacer(1, hauteur * mm)], [P(droite, 'centre_gras'), Spacer(1, hauteur * mm)]]],
        colWidths=[LARGEUR / 2, LARGEUR / 2],
    )


def note(texte):
    return P(texte, 'petit')


# ----------------------------------------------------------- Construction
class NumberedCanvas(canvas.Canvas):
    """Pied de page avec « Page x / n » (le total n'est connu qu'à la fin)."""
    pied_texte = ''

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._etats = []

    def showPage(self):
        self._etats.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total = len(self._etats)
        for etat in self._etats:
            self.__dict__.update(etat)
            self._pied(total)
            super().showPage()
        super().save()

    def _pied(self, total):
        self.setStrokeColor(CLAIR)
        self.setLineWidth(0.6)
        self.line(18 * mm, 15 * mm, A4[0] - 18 * mm, 15 * mm)
        self.setFont('Helvetica', 7.5)
        self.setFillColor(GRIS)
        self.drawString(18 * mm, 10.5 * mm, self.pied_texte)
        self.drawRightString(A4[0] - 18 * mm, 10.5 * mm, f"Page {self._pageNumber} / {total}")


def pied_de_page(user):
    nom = getattr(user, 'nom_complet', None) or getattr(user, 'identifiant', '')
    return f"{config()['nom']} · document édité le {fmt_dt(timezone.now())} par {nom}"


def construire(story, titre, user):
    tampon = io.BytesIO()
    doc = SimpleDocTemplate(
        tampon, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
        topMargin=14 * mm, bottomMargin=20 * mm,
        title=sur(titre), author=sur(config()['nom']),
    )

    class Canvas(NumberedCanvas):
        pied_texte = sur(pied_de_page(user))

    doc.build(story, canvasmaker=Canvas)
    return tampon.getvalue()


# ------------------------------------------------- Clients des documents
def _lignes_client(client):
    lignes = [kv('Nom', client.nom_client), kv('Type', client.get_type_client_display()
              if hasattr(client, 'get_type_client_display') else client.type_client)]
    organisme = getattr(client, 'organisme', None)
    if organisme is not None:
        lignes.append(kv('Organisme', organisme.nom_organisme))
    if getattr(client, 'code_soa', None):
        lignes.append(kv('Code SOA', client.code_soa))
    if getattr(client, 'adresse', None):
        lignes.append(kv('Adresse', client.adresse))
    if getattr(client, 'telephone', None):
        lignes.append(kv('Téléphone', client.telephone))
    if getattr(client, 'cin_ou_nif', None):
        lignes.append(kv('CIN / NIF', client.cin_ou_nif))
    return lignes


def bloc_client(client):
    if client is None:
        return encadre('Client', [esc('—')])
    return encadre('Client', _lignes_client(client))


def client_livraison(bl):
    """Client d'un bon de livraison : via la préparation ou via la facture comptoir."""
    preparation = getattr(bl, 'preparation', None)
    if preparation is not None:
        commande = getattr(preparation, 'commande', None)
        if commande is not None and getattr(commande, 'client', None) is not None:
            return commande.client
    facture = getattr(bl, 'facture', None)
    if facture is not None:
        return facture.client_facture
    return None


def client_relance(dossier):
    """Client d'un dossier de recouvrement : celui de la première facture liée."""
    try:
        ligne = dossier.lignes.select_related(
            'facture__commande__client', 'facture__client').first()
    except Exception:
        ligne = dossier.lignes.first() if hasattr(dossier, 'lignes') else None
    if ligne is not None and getattr(ligne, 'facture', None) is not None:
        return ligne.facture.client_facture
    return None


def _tableau_produits(colonnes, lignes, poids, total=None):
    story = [tableau(colonnes, lignes, poids, droite=tuple(range(1, len(colonnes))))]
    if total is not None:
        story += [Spacer(1, 6), totaux(total)]
    return story


def _total(lignes, montant):
    return Decimal(str(montant))


# ------------------------------------------------------------------ Devis
def pdf_devis(devis, user):
    story = []
    story += entete()
    story += titre_doc('DEVIS PROFORMA', devis.num_devis)
    gauche = encadre('Document', [
        kv('Date', fmt_date(devis.date_devis)),
        kv('Validité', f"{devis.validite_jours} jours"),
        kv('Expiration', fmt_date(devis.date_expiration)),
    ])
    story += [deux_colonnes(gauche, bloc_client(getattr(devis, 'client', None))), Spacer(1, 10)]
    lignes, total = [], Decimal('0')
    for l in devis.lignes.select_related('produit').all():
        montant = Decimal(str(l.quantite)) * Decimal(str(l.prix_unitaire_devis))
        total += montant
        lignes.append([sur(l.produit.designation), nombre(l.quantite),
                       ar(l.prix_unitaire_devis), ar(montant)])
    story += _tableau_produits(
        ['Désignation', 'Qté', 'Prix unitaire', 'Montant'],
        lignes, [8, 2, 4, 4], [('Montant total', ar(total), True)])
    story += [Spacer(1, 8), phrase_lettres('Arrêté le présent devis à la somme de', total),
              Spacer(1, 6), note(f"Devis valable {devis.validite_jours} jours.")]
    story += [Spacer(1, 14), signatures('Le client', "L'Imprimerie Nationale")]
    return construire(story, f"Devis {devis.num_devis}", user)


# --------------------------------------------------------------- Commande
def pdf_commande(commande, user):
    story = []
    story += entete()
    story += titre_doc('BON DE COMMANDE', commande.num_commande)
    refs = [kv('Date', fmt_date(commande.date_commande)), kv('Statut', commande.statut_commande)]
    if getattr(commande, 'devis', None) is not None:
        refs.append(kv('Devis', commande.devis.num_devis))
    gauche = encadre('Document', refs)
    story += [deux_colonnes(gauche, bloc_client(getattr(commande, 'client', None))), Spacer(1, 10)]
    lignes, total = [], Decimal('0')
    for l in commande.lignes.select_related('produit').all():
        montant = Decimal(str(l.quantite_commandee)) * Decimal(str(l.prix_unitaire_facture))
        total += montant
        lignes.append([sur(l.produit.designation), nombre(l.quantite_commandee),
                       ar(l.prix_unitaire_facture), ar(montant)])
    story += _tableau_produits(
        ['Désignation', 'Qté', 'Prix unitaire', 'Montant'],
        lignes, [8, 2, 4, 4], [('Montant total', ar(total), True)])
    story += [Spacer(1, 8), phrase_lettres('Arrêtée la présente commande à la somme de', total)]
    story += [Spacer(1, 14), signatures('Le client', "L'Imprimerie Nationale")]
    return construire(story, f"Commande {commande.num_commande}", user)


# --------------------------------------------------------------- Livraison
def pdf_livraison(bl, user):
    story = []
    story += entete()
    story += titre_doc('BON DE LIVRAISON', bl.num_bl)
    refs = [kv('Date', fmt_date(bl.date_livraison))]
    preparation = getattr(bl, 'preparation', None)
    if preparation is not None and getattr(preparation, 'commande', None) is not None:
        refs.append(kv('Commande', preparation.commande.num_commande))
    facture = getattr(bl, 'facture', None)
    if facture is not None:
        refs.append(kv('Facture', facture.num_facture))
    gauche = encadre('Document', refs)
    story += [deux_colonnes(gauche, bloc_client(client_livraison(bl))), Spacer(1, 10)]
    lignes = [[sur(l.produit.designation), nombre(l.quantite_livree)]
              for l in bl.lignes.select_related('produit').all()]
    story += [tableau(['Désignation', 'Qté livrée'], lignes, [10, 3], droite=(1,))]
    story += [Spacer(1, 14), signatures('Le livreur', 'Le réceptionnaire')]
    return construire(story, f"Bon de livraison {bl.num_bl}", user)


# ---------------------------------------------------------------- Facture
def pdf_facture(facture, user):
    story = []
    story += entete()
    story += titre_doc('FACTURE', facture.num_facture)
    refs = [kv('Date', fmt_date(facture.date_facture)),
            kv('Type', facture.type_facturation), kv('Paiement', facture.statut_paiement)]
    if getattr(facture, 'commande', None) is not None:
        refs.append(kv('Commande', facture.commande.num_commande))
    gauche = encadre('Document', refs)
    story += [deux_colonnes(gauche, bloc_client(facture.client_facture)), Spacer(1, 10)]
    lignes = []
    for l in facture.lignes.select_related('produit').all():
        montant = Decimal(str(l.quantite_facturee)) * Decimal(str(l.prix_unitaire))
        lignes.append([sur(l.produit.designation), nombre(l.quantite_facturee),
                       ar(l.prix_unitaire), ar(montant)])
    story += _tableau_produits(
        ['Désignation', 'Qté', 'Prix unitaire', 'Montant'], lignes, [8, 2, 4, 4],
        [('Montant HT', ar(facture.montant_ht)),
         ('TVA', ar(facture.tva)),
         ('Montant TTC', ar(facture.montant_ttc), True)])
    story += [Spacer(1, 8),
              phrase_lettres('Arrêtée la présente facture à la somme de', facture.montant_ttc)]
    story += [Spacer(1, 14), signatures('Le client', "L'Imprimerie Nationale")]
    return construire(story, f"Facture {facture.num_facture}", user)


# ------------------------------------------------------------------ Avoir
def pdf_avoir(avoir, user):
    story = []
    story += entete()
    story += titre_doc('AVOIR', avoir.num_avoir)
    gauche = encadre('Document', [
        kv('Date', fmt_date(avoir.date_avoir)),
        kv('Facture', avoir.facture.num_facture),
        kv('Motif', avoir.motif or '—'),
    ])
    story += [deux_colonnes(gauche, bloc_client(avoir.facture.client_facture)), Spacer(1, 10)]
    lignes, total = [], Decimal('0')
    for l in avoir.lignes.select_related('produit').all():
        total += Decimal(str(l.montant_avoir))
        lignes.append([sur(l.produit.designation), nombre(l.quantite_retournee), ar(l.montant_avoir)])
    story += _tableau_produits(
        ['Désignation', 'Qté retournée', 'Montant'], lignes, [9, 3, 4],
        [('Montant total', ar(total), True)])
    story += [Spacer(1, 8), phrase_lettres("Arrêté le présent avoir à la somme de", total)]
    story += [Spacer(1, 14), signatures('Le client', "L'Imprimerie Nationale")]
    return construire(story, f"Avoir {avoir.num_avoir}", user)


# ------------------------------------------------------------------ Reçu
def pdf_recu(reglement, user):
    story = []
    story += entete()
    story += titre_doc('REÇU DE PAIEMENT', f"R-{reglement.pk:06d}")
    if getattr(reglement, 'statut', None) == 'ANNULE':
        motif = getattr(reglement, 'motif_annulation', None) or '—'
        quand = fmt_dt(reglement.date_annulation) if getattr(reglement, 'date_annulation', None) else '—'
        story += [P(f"QUITTANCE ANNULÉE le {quand} — motif : {motif}", 'alerte'), Spacer(1, 6)]
    quittance = getattr(reglement, 'quittance', None)
    try:
        quittance  # déclenche la requête reverse OneToOne si absente -> DoesNotExist
    except Exception:
        quittance = None
    refs = [kv('Date', fmt_date(reglement.date_reglement)),
            kv('Mode', reglement.mode_reglement),
            kv('Facture', reglement.facture.num_facture),
            kv('Montant facture (TTC)', ar(reglement.facture.montant_ttc))]
    if quittance is not None:
        refs.append(kv('Quittance',
                       f"{quittance.livre.numero_livre} / feuille {quittance.num_feuille} / "
                       f"volet {quittance.attribut_volet}"))
        refs.append(kv('Caisse', f"{quittance.caisse.code_caisse} — {quittance.caisse.libelle_caisse}"))
    elif getattr(reglement, 'num_virement_tresor', None):
        refs.append(kv('Virement Trésor', reglement.num_virement_tresor))
    gauche = encadre('Règlement', refs)
    story += [deux_colonnes(gauche, bloc_client(reglement.facture.client_facture)), Spacer(1, 10)]
    story += [tableau(['Montant réglé'], [[ar(reglement.montant_regle)]], [1], droite=(0,))]
    story += [Spacer(1, 8),
              phrase_lettres('Reçu la somme de', reglement.montant_regle)]
    story += [Spacer(1, 14), signatures('Le caissier', 'Le client')]
    return construire(story, f"Recu R-{reglement.pk:06d}", user)


# ----------------------------------------------------------------- Relance
_TITRES_RELANCE = {1: 'LETTRE DE RELANCE', 2: 'DEUXIÈME RELANCE', 3: 'MISE EN DEMEURE'}
_TEXTE_RELANCE = {
    1: "Nous vous rappelons que les factures ci-dessous restent impayées. "
       "Nous vous prions de bien vouloir procéder à leur règlement dans le délai indiqué.",
    2: "Malgré notre premier rappel, les factures ci-dessous demeurent impayées. "
       "Nous vous demandons de régulariser votre situation dans le délai indiqué.",
    3: "Malgré nos précédents rappels, votre dossier reste impayé. "
       "La présente vaut mise en demeure : à défaut de paiement dans le délai indiqué, "
       "votre dossier sera transmis au contentieux.",
}


def pdf_relance(dossier, user, niveau=None):
    niveau = niveau or getattr(dossier, 'niveau_relance', 1) or 1
    titre = _TITRES_RELANCE.get(niveau, 'LETTRE DE RELANCE')
    story = []
    story += entete()
    story += titre_doc(titre, dossier.num_dossier)
    delais = getattr(settings, 'RELANCE_DELAI_JOURS', {})
    ville = getattr(settings, 'INM_VILLE', 'Antananarivo')
    gauche = encadre('Dossier', [
        kv('Date', fmt_date(dossier.date_relance)),
        kv('Niveau', str(niveau)),
        kv('Délai accordé', f"{delais.get(niveau, 15)} jours"),
    ])
    story += [deux_colonnes(gauche, bloc_client(client_relance(dossier))), Spacer(1, 10)]
    story += [P(f"{ville}, le {fmt_date(timezone.now())}.", 'droite'), Spacer(1, 6),
              P(_TEXTE_RELANCE.get(niveau, _TEXTE_RELANCE[1]), 'justify'), Spacer(1, 8)]
    lignes, total = [], Decimal('0')
    for l in dossier.lignes.select_related('facture').all():
        total += Decimal(str(l.montant_a_recouvrer))
        lignes.append([sur(l.facture.num_facture), fmt_date(l.facture.date_facture),
                       ar(l.montant_a_recouvrer)])
    story += _tableau_produits(
        ['Facture', 'Date', 'Reste dû'], lignes, [5, 4, 4],
        [('Total à recouvrer', ar(total), True)])
    story += [Spacer(1, 8), phrase_lettres('Le montant total à recouvrer est de', total)]
    story += [Spacer(1, 14), signatures("L'Imprimerie Nationale", 'Le client')]
    return construire(story, f"{titre} {dossier.num_dossier}", user)