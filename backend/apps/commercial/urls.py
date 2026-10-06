from rest_framework.routers import DefaultRouter

from .views import CommandeViewSet, DevisProformaViewSet, PlanificationBesoinViewSet
from .views_aval import (
    AvoirViewSet, BonLivraisonViewSet, FactureViewSet, PreparationCommandeViewSet,
)

router = DefaultRouter()
router.register('planifications', PlanificationBesoinViewSet, basename='planification')
router.register('devis', DevisProformaViewSet, basename='devis')
router.register('commandes', CommandeViewSet, basename='commande')
router.register('preparations', PreparationCommandeViewSet, basename='preparation')
router.register('livraisons', BonLivraisonViewSet, basename='livraison')
router.register('factures', FactureViewSet, basename='facture')
router.register('avoirs', AvoirViewSet, basename='avoir')

urlpatterns = router.urls