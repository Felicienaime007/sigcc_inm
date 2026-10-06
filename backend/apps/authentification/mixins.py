from django.db.models import ProtectedError
from rest_framework import status
from rest_framework.response import Response


class ParamFilterMixin:
    """Filtres par paramètres URL : query_filters = {param_url: champ_orm}."""

    query_filters = {}

    def get_queryset(self):
        qs = super().get_queryset()
        for param, field in self.query_filters.items():
            value = self.request.query_params.get(param)
            if value not in (None, ''):
                qs = qs.filter(**{field: value})
        return qs


class ProtectedDeleteMixin:
    """Suppression protégée : 409 si des enregistrements enfants existent."""

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {'detail': 'Suppression impossible : des éléments dépendants y sont rattachés.'},
                status=status.HTTP_409_CONFLICT,
            )
