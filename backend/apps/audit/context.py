from contextvars import ContextVar

_request = ContextVar('audit_request', default=None)


def set_request(request):
    return _request.set(request)


def reset_request(token):
    _request.reset(token)


def _ip(request):
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def acteur():
    """Retourne (id_utilisateur, identifiant, adresse_ip) de l'auteur de l'opération."""
    request = _request.get()
    if request is None:
        return None, 'SYSTEME', None            # shell, commande manage.py, tâche planifiée
    user = getattr(request, 'user', None)       # posé par DRF après l'authentification JWT
    if user is not None and getattr(user, 'is_authenticated', False):
        return user.pk, user.identifiant, _ip(request)
    return None, 'ANONYME', _ip(request)