from rest_framework.routers import DefaultRouter

from .views import (
    BudgetViewSet, EngagementBudgetViewSet, LigneBudgetaireViewSet,
    PrevisionBudgetaireViewSet, TypeFinancementViewSet,
)

router = DefaultRouter()
router.register('types-financement', TypeFinancementViewSet, basename='type-financement')
router.register('budgets', BudgetViewSet, basename='budget')
router.register('lignes', LigneBudgetaireViewSet, basename='ligne-budgetaire')
router.register('previsions', PrevisionBudgetaireViewSet, basename='prevision')
router.register('engagements', EngagementBudgetViewSet, basename='engagement')

urlpatterns = router.urls