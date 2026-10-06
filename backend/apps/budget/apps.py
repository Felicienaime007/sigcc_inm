from django.apps import AppConfig


class BudgetConfig(AppConfig):
    default_auto_field = 'django.db.models.AutoField'
    name = 'apps.budget'
    label = 'budget'
    verbose_name = 'Finances publiques & budgets'