from rest_framework.routers import DefaultRouter

from .views import (
    CategorieProduitViewSet, ConfigSerieViewSet,
    LotLancementSerieViewSet, ProduitFiniViewSet,
)

router = DefaultRouter()
router.register('categories', CategorieProduitViewSet, basename='categorie')
router.register('configs-serie', ConfigSerieViewSet, basename='config-serie')
router.register('lots', LotLancementSerieViewSet, basename='lot')
router.register('', ProduitFiniViewSet, basename='produit')   # /api/produits/

urlpatterns = router.urls