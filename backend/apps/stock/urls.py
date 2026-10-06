from rest_framework.routers import DefaultRouter

from .views import (
    EmplacementViewSet, LigneStockViewSet, MagasinDepotViewSet,
    MouvementStockViewSet, ReservationStockViewSet,
)

router = DefaultRouter()
router.register('magasins', MagasinDepotViewSet, basename='magasin')
router.register('emplacements', EmplacementViewSet, basename='emplacement')
router.register('lignes', LigneStockViewSet, basename='ligne-stock')
router.register('reservations', ReservationStockViewSet, basename='reservation')
router.register('mouvements', MouvementStockViewSet, basename='mouvement')

urlpatterns = router.urls