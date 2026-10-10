from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.authentification.urls')),
    path('api/users/', include('apps.users.urls')),
    path('api/territoire/', include('apps.territoire.urls')),
    path('api/clients/', include('apps.clients.urls')),
    path('api/budget/', include('apps.budget.urls')),
    path('api/produits/', include('apps.produits.urls')),
    path('api/commercial/', include('apps.commercial.urls')),
    path('api/stock/', include('apps.stock.urls')),
    path('api/tresorerie/', include('apps.tresorerie.urls')),
    path('api/recouvrement/', include('apps.recouvrement.urls')),
    path('api/audit/', include('apps.audit.urls')),
    path('api/statistiques/', include('apps.statistiques.urls')),
    path('api/editions/', include('apps.editions.urls')),
    path('api/etats/', include('apps.etats.urls')),
    path('api/notifications/', include('apps.notifications.urls')),
]
