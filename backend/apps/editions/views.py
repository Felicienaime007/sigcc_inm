from django.http import Http404, HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView

from apps.authentification.permissions import HasPrivilege
from apps.clients.permissions import peut_voir
from apps.commercial.models import Avoir, BonLivraison, Commande, DevisProforma, Facture
from apps.recouvrement.models import Recouvrement
from apps.tresorerie.models import Reglement

from . import documents as docs


class EditionBase(APIView):
    """Édition d'un document : mêmes droits et même visibilité que les écrans correspondants."""
    permission_classes = [HasPrivilege]
    queryset = None

    def client_de(self, obj):
        raise NotImplementedError

    def fabriquer(self, obj, user):
        raise NotImplementedError

    def nom(self, obj):
        raise NotImplementedError

    def get(self, request, pk):
        obj = get_object_or_404(self.queryset, pk=pk)
        client = self.client_de(obj)
        if client is None or not peut_voir(request.user, client):
            raise Http404   # un type de client invisible pour ce rôle se comporte comme un document absent
        contenu = self.fabriquer(obj, request.user)
        reponse = HttpResponse(contenu, content_type='application/pdf')
        reponse['Content-Disposition'] = f'inline; filename="{self.nom(obj).replace("/", "-")}.pdf"'
        reponse['Cache-Control'] = 'no-store'
        return reponse


class DevisPdf(EditionBase):
    privilege_map = {'get': 'devis.view'}
    queryset = DevisProforma.objects.select_related('client__organisme').prefetch_related('lignes__produit')
    client_de = lambda self, o: o.client
    fabriquer = lambda self, o, u: docs.pdf_devis(o, u)
    nom = lambda self, o: o.num_devis


class CommandePdf(EditionBase):
    privilege_map = {'get': 'commande.view'}
    queryset = Commande.objects.select_related('client__organisme', 'devis', 'engagement').prefetch_related('lignes__produit')
    client_de = lambda self, o: o.client
    fabriquer = lambda self, o, u: docs.pdf_commande(o, u)
    nom = lambda self, o: o.num_commande


class LivraisonPdf(EditionBase):
    privilege_map = {'get': 'livraison.view'}
    queryset = BonLivraison.objects.select_related(
        'preparation__commande__client', 'facture__client', 'facture__commande__client',
    ).prefetch_related('lignes__produit')
    client_de = lambda self, o: docs.client_livraison(o)
    fabriquer = lambda self, o, u: docs.pdf_livraison(o, u)
    nom = lambda self, o: o.num_bl


class FacturePdf(EditionBase):
    privilege_map = {'get': 'facture.view'}
    queryset = Facture.objects.select_related('commande__client', 'client').prefetch_related('lignes__produit')
    client_de = lambda self, o: o.client_facture
    fabriquer = lambda self, o, u: docs.pdf_facture(o, u)
    nom = lambda self, o: o.num_facture


class AvoirPdf(EditionBase):
    privilege_map = {'get': 'avoir.view'}
    queryset = Avoir.objects.select_related('facture__commande__client', 'facture__client').prefetch_related('lignes__produit')
    client_de = lambda self, o: o.facture.client_facture
    fabriquer = lambda self, o, u: docs.pdf_avoir(o, u)
    nom = lambda self, o: o.num_avoir


class ReglementPdf(EditionBase):
    privilege_map = {'get': 'reglement.view'}
    queryset = Reglement.objects.select_related(
        'facture__commande__client', 'facture__client', 'quittance__livre', 'quittance__caisse'
    )
    client_de = lambda self, o: o.facture.client_facture
    fabriquer = lambda self, o, u: docs.pdf_recu(o, u)
    nom = lambda self, o: f"recu-R-{o.pk:06d}"


class RelancePdf(EditionBase):
    privilege_map = {'get': 'recouvrement.view'}
    queryset = Recouvrement.objects.prefetch_related('lignes__facture__commande__client', 'lignes__facture__client')
    client_de = lambda self, o: docs.client_relance(o)
    fabriquer = lambda self, o, u: docs.pdf_relance(o, u)
    nom = lambda self, o: f"relance-{o.num_dossier}"