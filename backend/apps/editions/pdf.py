"""Module manquant `apps.editions.pdf`.

`apps/etats/exports.py` importe `from apps.editions import pdf as p` et utilise
une API « paysage » (LARGEUR_PAYSAGE, tableau(..., largeur=...),
construire(..., paysage=True)) qui n'existait que dans `documents.py` en
version portrait.

Ce module est un adaptateur minimal : il ré-exporte les briques de
`documents.py` et ajoute le support paysage, sans modifier le code existant.
"""
import io

from django.conf import settings
from django.utils import timezone
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate

from . import documents as _d
from .documents import (  # noqa: F401 -- ré-export
    NBSP,
    P,
    fmt_date,
    fmt_dt,
    note,
    nombre,
    titre_doc,
    totaux,
)

LARGEUR = _d.LARGEUR
LARGEUR_PAYSAGE = landscape(A4)[0] - 36 * mm


def entete():
    """En-tête des états : pleine largeur paysage, avec le logo."""
    return _d.entete(largeur=LARGEUR_PAYSAGE)


def tableau(entetes, lignes, poids, droite=(), largeur=None):
    """Comme documents.tableau mais accepte une largeur utile personnalisée."""
    from reportlab.lib import colors
    from reportlab.platypus import Paragraph, Table, TableStyle

    base = largeur if largeur else _d.LARGEUR
    total = sum(poids)
    largeurs = [base * p / total for p in poids]
    data = [[P(h, 'th_d' if i in droite else 'th') for i, h in enumerate(entetes)]]
    for ligne in lignes:
        data.append([P(c, 'cell_d' if i in droite else 'cell') for i, c in enumerate(ligne)])
    t = Table(data, colWidths=largeurs, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), _d.BLEU),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9fafb')]),
        ('LINEBELOW', (0, 1), (-1, -1), 0.4, _d.CLAIR),
        ('BOX', (0, 0), (-1, -1), 0.6, _d.CLAIR),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 5), ('RIGHTPADDING', (0, 0), (-1, -1), 5),
    ]))
    return t


def construire(story, titre, user, paysage=False):
    """Comme documents.construire avec option paysage pour les états."""
    if not paysage:
        return _d.construire(story, titre, user)
    tampon = io.BytesIO()
    pagesize = landscape(A4)
    doc = SimpleDocTemplate(
        tampon, pagesize=pagesize, leftMargin=18 * mm, rightMargin=18 * mm,
        topMargin=14 * mm, bottomMargin=20 * mm,
        title=_d.sur(titre), author=_d.sur(_d.config()['nom']),
    )

    class Canvas(_d.NumberedCanvas):
        pied_texte = _d.sur(_d.pied_de_page(user))

        def _pied(self, total):
            self.setStrokeColor(_d.CLAIR)
            self.setLineWidth(0.6)
            self.line(18 * mm, 15 * mm, pagesize[0] - 18 * mm, 15 * mm)
            self.setFont('Helvetica', 7.5)
            self.setFillColor(_d.GRIS)
            self.drawString(18 * mm, 10.5 * mm, self.pied_texte)
            self.drawRightString(pagesize[0] - 18 * mm, 10.5 * mm, f"Page {self._pageNumber} / {total}")

    doc.build(story, canvasmaker=Canvas)
    return tampon.getvalue()
