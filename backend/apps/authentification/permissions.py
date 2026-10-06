from rest_framework.permissions import BasePermission

from apps.audit.context import set_request


def crud_map(resource):
    """Mappe les actions DRF d'un ViewSet vers les privilèges '<ressource>.<action>'."""
    return {
        'list': f'{resource}.view',
        'retrieve': f'{resource}.view',
        'create': f'{resource}.create',
        'update': f'{resource}.update',
        'partial_update': f'{resource}.update',
        'destroy': f'{resource}.delete',
    }


class HasPrivilege(BasePermission):
    """
    Vérifie que l'utilisateur possède le privilège requis par la vue.

    Sur la vue, définir :
        privilege_map = {'list': 'client.view', 'create': 'client.create', ...}
    - Clé = nom de l'action DRF (ViewSet) ou méthode HTTP en minuscule (APIView).
    - Clé '*' = privilège par défaut.
    - Si aucun privilège n'est défini pour l'action -> accès REFUSÉ (deny by default).
    - Le rôle ADMIN a accès à tout.
    """
    message = "Vous n'avez pas le privilège nécessaire pour cette action."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        # Audit : la requête DRF porte l'utilisateur JWT (la requête Django
        # mémorisée par le middleware ne le connaît pas) — elle fait foi.
        set_request(request)

        mapping = getattr(view, 'privilege_map', {})
        key = getattr(view, 'action', None) or request.method.lower()
        required = mapping.get(key) or mapping.get('*')
        if not required:
            return False
        if isinstance(required, (list, tuple, set)):
            return any(user.has_privilege(p) for p in required)
        return user.has_privilege(required)