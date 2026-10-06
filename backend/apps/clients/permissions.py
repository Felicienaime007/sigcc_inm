from .models import Client

T = Client.TypeClient

# Types gérés par « client.* » (le commercial) ; SIMPLE relève de « client_simple.* » (la réception)
TYPES_NON_SIMPLES = {T.MINISTERE, T.CTD, T.PRIVE}


def types_geres(user, action):
    """Types que l'utilisateur peut créer / modifier / supprimer ('create', 'update', 'delete')."""
    types = set()
    if user.has_privilege(f'client.{action}'):
        types |= TYPES_NON_SIMPLES
    if user.has_privilege(f'client_simple.{action}'):
        types.add(T.SIMPLE)
    return types


def types_visibles(user):
    """Types que l'utilisateur peut consulter (ADMIN : tous)."""
    types = set()
    if user.has_privilege('client.view'):
        types |= TYPES_NON_SIMPLES
    if user.has_privilege('client_simple.view'):
        types.add(T.SIMPLE)
    return types


def peut_voir(user, client):
    return client.type_client in types_visibles(user)