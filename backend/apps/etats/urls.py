from django.urls import path

from .views import EtatView

urlpatterns = [
    path('<str:code>/', EtatView.as_view(), name='etat'),
]