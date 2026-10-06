from rest_framework.routers import DefaultRouter

from .views import PrivilegeViewSet, RoleViewSet, UtilisateurViewSet

router = DefaultRouter()
router.register('utilisateurs', UtilisateurViewSet, basename='utilisateur')
router.register('roles', RoleViewSet, basename='role')
router.register('privileges', PrivilegeViewSet, basename='privilege')

urlpatterns = router.urls