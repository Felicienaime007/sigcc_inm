from rest_framework.routers import DefaultRouter

from .views import AuditLogViewSet

router = DefaultRouter()
router.register('journal', AuditLogViewSet, basename='audit')

urlpatterns = router.urls