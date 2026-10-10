from rest_framework.routers import DefaultRouter

from .views import (
    ArreteCaisseViewSet, CaisseViewSet, LivreCaisseViewSet, LivreQuittanceViewSet,
    QuittanceViewSet, ReglementViewSet, RemiseBanqueViewSet,
)

router = DefaultRouter()
router.register('caisses', CaisseViewSet, basename='caisse')
router.register('livres', LivreQuittanceViewSet, basename='livre-quittance')
router.register('quittances', QuittanceViewSet, basename='quittance')
router.register('reglements', ReglementViewSet, basename='reglement')
router.register('livre-caisse', LivreCaisseViewSet, basename='livre-caisse')
router.register('arretes', ArreteCaisseViewSet, basename='arrete-caisse')
router.register('remises', RemiseBanqueViewSet, basename='remise-banque')

urlpatterns = router.urls