from django.urls import path

from .etats import BalanceAgeeView, EncaissementsView, JournalVentesView
from .views import (
    AvoirPdf, CommandePdf, DevisPdf, FacturePdf, LivraisonPdf, ReglementPdf, RelancePdf,
)

urlpatterns = [
    path('devis/<int:pk>/', DevisPdf.as_view()),
    path('commande/<int:pk>/', CommandePdf.as_view()),
    path('livraison/<int:pk>/', LivraisonPdf.as_view()),
    path('facture/<int:pk>/', FacturePdf.as_view()),
    path('avoir/<int:pk>/', AvoirPdf.as_view()),
    path('reglement/<int:pk>/', ReglementPdf.as_view()),
    path('relance/<int:pk>/', RelancePdf.as_view()),
    # États de synthèse : ?export=json|csv|xlsx|pdf&du=AAAA-MM-JJ&au=AAAA-MM-JJ&client=<id>
    path('journal-ventes/', JournalVentesView.as_view()),
    path('balance-agee/', BalanceAgeeView.as_view()),
    path('encaissements/', EncaissementsView.as_view()),
]