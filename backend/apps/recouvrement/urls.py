from rest_framework.routers import DefaultRouter

from .views import RecouvrementViewSet

router = DefaultRouter()
router.register('dossiers', RecouvrementViewSet, basename='dossier-recouvrement')

urlpatterns = router.urls