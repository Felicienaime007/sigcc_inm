from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.filters import OrderingFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.users.models import Utilisateur

from . import services
from .catalogue import TYPES
from .models import Notification, TypeMasque
from .serializers import AnnonceSerializer, NotificationSerializer


class NotificationViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet,
):
    """Toujours limité aux notifications de l'utilisateur connecté."""
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationSerializer
    filter_backends = [OrderingFilter]
    ordering_fields = ['cree_le']

    def get_queryset(self):
        qs = Notification.objects.filter(utilisateur=self.request.user)
        p = self.request.query_params
        if p.get('lu') == 'true':
            qs = qs.filter(lu_le__isnull=False)
        elif p.get('lu') == 'false':
            qs = qs.filter(lu_le__isnull=True)
        if p.get('niveau'):
            qs = qs.filter(niveau=p['niveau'])
        if p.get('type'):
            qs = qs.filter(type_notif=p['type'])
        return qs

    # ----------------------------------------------------- Cloche (interrogation légère)
    @action(detail=False, methods=['get'])
    def resume(self, request):
        """Compteur + nouveautés depuis l'identifiant `apres` + 8 dernières notifications."""
        try:
            apres = int(request.query_params.get('apres') or 0)
        except ValueError:
            apres = 0
        tout = Notification.objects.filter(utilisateur=request.user)
        non_lues = tout.filter(lu_le__isnull=True)
        return Response({
            'non_lues': non_lues.count(),
            'derniere': tout.order_by('-pk').values_list('pk', flat=True).first() or 0,
            'nouvelles': NotificationSerializer(non_lues.filter(pk__gt=apres).order_by('pk')[:5], many=True).data,
            'recentes': NotificationSerializer(tout[:8], many=True).data,
        })

    # --------------------------------------------------------------------- Lecture
    @action(detail=True, methods=['post'])
    def lire(self, request, pk=None):
        n = self.get_object()
        if n.lu_le is None:
            n.lu_le = timezone.now()
            n.save(update_fields=['lu_le'])
        return Response(self.get_serializer(n).data)

    @action(detail=False, methods=['post'], url_path='lire-tout')
    def lire_tout(self, request):
        n = Notification.objects.filter(utilisateur=request.user, lu_le__isnull=True).update(lu_le=timezone.now())
        return Response({'marquees': n})

    @action(detail=False, methods=['post'], url_path='supprimer-lues')
    def supprimer_lues(self, request):
        n, _ = Notification.objects.filter(utilisateur=request.user, lu_le__isnull=False).delete()
        return Response({'supprimees': n})

    # ------------------------------------------------------------------ Préférences
    @action(detail=False, methods=['get', 'post'])
    def preferences(self, request):
        user = request.user
        if request.method == 'POST':
            type_, active = request.data.get('type'), request.data.get('active')
            definition = TYPES.get(type_)
            if definition is None:
                raise ValidationError({'type': "Type de notification inconnu."})
            if definition.get('obligatoire'):
                raise ValidationError({'type': "Ce type de notification ne peut pas être désactivé."})
            if not isinstance(active, bool):
                raise ValidationError({'active': "Valeur booléenne attendue."})
            if active:
                TypeMasque.objects.filter(utilisateur=user, type_notif=type_).delete()
            else:
                TypeMasque.objects.get_or_create(utilisateur=user, type_notif=type_)

        roles = set(user.role_codes)
        masques = set(TypeMasque.objects.filter(utilisateur=user).values_list('type_notif', flat=True))
        return Response([
            {
                'type': code, 'libelle': d['libelle'], 'description': d['description'],
                'niveau': d['niveau'], 'obligatoire': bool(d.get('obligatoire')),
                'active': code not in masques,
            }
            for code, d in TYPES.items()
            if d.get('obligatoire') or roles & set(d['roles'])
        ])

    # --------------------------------------------------------------------- Annonces
    @action(detail=False, methods=['post'])
    def annonces(self, request):
        if not request.user.has_privilege('notification.annoncer'):
            raise PermissionDenied("Vous n'avez pas le privilège d'envoyer des annonces.")
        s = AnnonceSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        if d['tous']:
            ids = Utilisateur.objects.filter(statut_compte='ACTIF').values_list('pk', flat=True)
        else:
            ids = Utilisateur.objects.filter(
                statut_compte='ACTIF', roles__libelle_role__in=d['roles']
            ).values_list('pk', flat=True).distinct()
        n = services.notifier(
            'annonce', d['titre'], d.get('message', ''), lien=d.get('lien') or None,
            utilisateurs=list(ids), niveau=d['niveau'], exclure=request.user.pk,
        )
        return Response({'envoyees': n}, status=status.HTTP_201_CREATED)