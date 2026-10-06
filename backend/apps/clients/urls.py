from rest_framework.routers import DefaultRouter

from .views import ClientViewSet, OrganismeViewSet, SolvabiliteViewSet

router = DefaultRouter()
router.register('organismes', OrganismeViewSet, basename='organisme')
router.register('clients', ClientViewSet, basename='client')
router.register('solvabilites', SolvabiliteViewSet, basename='solvabilite')

urlpatterns = router.urls
