from django.urls import path

from .views import TableauDeBordView

urlpatterns = [
    path('tableau-de-bord/', TableauDeBordView.as_view(), name='tableau-de-bord'),
]