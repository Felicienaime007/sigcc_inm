from rest_framework.routers import DefaultRouter

from .views import (
    CommuneViewSet, DistrictViewSet, FokontanyViewSet, ProvinceViewSet, RegionViewSet,
)

router = DefaultRouter()
router.register('provinces', ProvinceViewSet, basename='province')
router.register('regions', RegionViewSet, basename='region')
router.register('districts', DistrictViewSet, basename='district')
router.register('communes', CommuneViewSet, basename='commune')
router.register('fokontany', FokontanyViewSet, basename='fokontany')

urlpatterns = router.urls