from django.http import Http404, HttpResponse
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentification.permissions import HasPrivilege

from . import exports
from .rapports import APERCU, RAPPORTS

TYPES_EXPORT = {
    'csv': ('text/csv; charset=utf-8', 'csv'),
    'xlsx': ('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx'),
    'pdf': ('application/pdf', 'pdf'),
}


class EtatView(APIView):
    """
    GET /api/etats/<code>/?du=&au=&...            -> aperçu JSON (500 lignes au plus)
    GET /api/etats/<code>/?...&export=csv|xlsx|pdf -> fichier complet
    (le paramètre s'appelle « export » : « format » est réservé par Django REST framework)
    """
    permission_classes = [HasPrivilege]
    privilege_map = {'get': [r.privilege for r in RAPPORTS.values()]}   # au moins un état autorisé

    def get(self, request, code):
        rapport = RAPPORTS.get(code)
        if rapport is None:
            raise Http404
        if not request.user.has_privilege(rapport.privilege):
            raise PermissionDenied("Vous n'avez pas accès à cet état.")

        etat = rapport.fonction(request.user, request.query_params)
        export = request.query_params.get('export')
        if not export:
            lignes = etat['lignes']
            return Response({
                **etat, 'lignes': lignes[:APERCU],
                'total_lignes': len(lignes), 'tronque': len(lignes) > APERCU,
            })

        if export not in TYPES_EXPORT:
            raise ValidationError({'export': "Format d'export invalide (csv, xlsx ou pdf)."})
        contenu = {
            'csv': lambda: exports.csv_bytes(etat),
            'xlsx': lambda: exports.xlsx_bytes(etat),
            'pdf': lambda: exports.pdf_bytes(etat, request.user),
        }[export]()
        type_mime, extension = TYPES_EXPORT[export]
        reponse = HttpResponse(contenu, content_type=type_mime)
        reponse['Content-Disposition'] = f'attachment; filename="{etat["fichier"]}.{extension}"'
        reponse['Cache-Control'] = 'no-store'
        return reponse