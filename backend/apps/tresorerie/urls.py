from rest_framework.routers import DefaultRouter

from .views import (
    CaisseViewSet, LivreCaisseViewSet, LivreQuittanceViewSet,
    QuittanceViewSet, ReglementViewSet,
)

router = DefaultRouter()
router.register('caisses', CaisseViewSet, basename='caisse')
router.register('livres', LivreQuittanceViewSet, basename='livre-quittance')
router.register('quittances', QuittanceViewSet, basename='quittance')
router.register('reglements', ReglementViewSet, basename='reglement')
router.register('livre-caisse', LivreCaisseViewSet, basename='livre-caisse')

urlpatterns = router.urls