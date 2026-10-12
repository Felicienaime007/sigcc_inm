from django.db.models import Count
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.authentification.mixins import ParamFilterMixin
from apps.authentification.permissions import HasPrivilege, crud_map

from .models import Privilege, Role, Utilisateur
from .serializers import (
    PrivilegeSerializer, RoleSerializer, SetPasswordSerializer, UtilisateurSerializer,
)


class BaseViewSet(ParamFilterMixin, viewsets.ModelViewSet):
    permission_classes = [HasPrivilege]
    filter_backends = [SearchFilter, OrderingFilter]


class PrivilegeViewSet(BaseViewSet):
    queryset = Privilege.objects.all()
    serializer_class = PrivilegeSerializer
    privilege_map = crud_map('privilege')
    search_fields = ['code_action', 'description']
    ordering_fields = ['code_action']


class RoleViewSet(BaseViewSet):
    queryset = Role.objects.prefetch_related('privileges').annotate(
        nb_utilisateurs=Count('utilisateurs', distinct=True)
    )
    serializer_class = RoleSerializer
    privilege_map = crud_map('role')
    search_fields = ['libelle_role']
    ordering_fields = ['libelle_role', 'nb_utilisateurs']

    def destroy(self, request, *args, **kwargs):
        role = self.get_object()
        if role.libelle_role == 'ADMIN':
            return Response({'detail': "Le rôle ADMIN ne peut pas être supprimé."},
                            status=status.HTTP_400_BAD_REQUEST)
        if role.nb_utilisateurs:
            return Response(
                {'detail': f"Suppression impossible : ce rôle est attribué à "
                           f"{role.nb_utilisateurs} utilisateur(s). Retirez-le d'abord."},
                status=status.HTTP_409_CONFLICT,
            )
        return super().destroy(request, *args, **kwargs)


class UtilisateurViewSet(BaseViewSet):
    queryset = Utilisateur.objects.prefetch_related('roles')
    serializer_class = UtilisateurSerializer
    privilege_map = {**crud_map('utilisateur'), 'set_password': 'utilisateur.update'}
    search_fields = ['identifiant', 'matricule', 'nom_complet']
    ordering_fields = ['nom_complet', 'identifiant', 'matricule', 'statut_compte', 'last_login']
    query_filters = {'statut': 'statut_compte', 'role': 'roles'}

    def get_permissions(self):
        # La photo concerne aussi les rôles sans privilège `utilisateur.*` :
        # chacun modifie la sienne, l'admin celle de chacun (contrôle ci-dessous).
        if getattr(self, 'action', None) == 'photo':
            return [IsAuthenticated()]
        return super().get_permissions()

    def update(self, request, *args, **kwargs):
        cible = self.get_object()
        if cible.pk == request.user.pk:
            # Garde-fous : on ne peut pas se couper soi-même l'accès
            statut = request.data.get('statut_compte')
            if statut and statut != Utilisateur.Statut.ACTIF:
                return Response({'detail': "Vous ne pouvez pas désactiver votre propre compte."},
                                status=status.HTTP_400_BAD_REQUEST)
            if 'role_ids' in request.data and cible.is_admin:
                admin_id = Role.objects.filter(libelle_role='ADMIN') \
                    .values_list('pk', flat=True).first()
                try:
                    ids = {int(i) for i in (request.data.get('role_ids') or [])}
                except (TypeError, ValueError):
                    ids = {admin_id}   # valeur invalide : le serializer renverra l'erreur
                if admin_id not in ids:
                    return Response({'detail': "Vous ne pouvez pas retirer votre propre rôle ADMIN."},
                                    status=status.HTTP_400_BAD_REQUEST)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if self.get_object().pk == request.user.pk:
            return Response(
                {'detail': 'Vous ne pouvez pas supprimer votre propre compte.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'], url_path='photo')
    def photo(self, request, pk=None):
        """Définit ou retire la photo de profil (data URL d'image).

        Body {"photo": "data:image/jpeg;base64,..."} (ou null/"" pour retirer).
        Chacun modifie sa propre photo ; la photo d'autrui exige
        le privilège `utilisateur.update`.
        """
        from rest_framework.exceptions import ValidationError
        cible = self.get_object()
        if cible.pk != request.user.pk and not request.user.has_privilege('utilisateur.update'):
            raise PermissionDenied("Vous ne pouvez modifier que votre propre photo.")
        data_url = request.data.get('photo')
        if data_url in (None, ''):
            cible.photo = None
        else:
            if not isinstance(data_url, str) or not data_url.startswith('data:image/'):
                raise ValidationError(
                    {'photo': "Format attendu : data URL d'image (data:image/...)."}
                )
            if len(data_url) > 1_500_000:
                raise ValidationError(
                    {'photo': "Image trop lourde (1,5 Mo de données maximum)."}
                )
            cible.photo = data_url
        cible.save(update_fields=['photo'])
        return Response(self.get_serializer(cible).data)

    @action(detail=True, methods=['post'], url_path='set-password')
    def set_password(self, request, pk=None):
        """Réinitialisation du mot de passe par un administrateur."""
        user = self.get_object()
        serializer = SetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user.set_password(serializer.validated_data['new_password'])
        user.save(update_fields=['password'])
        return Response({'detail': 'Mot de passe réinitialisé.'})