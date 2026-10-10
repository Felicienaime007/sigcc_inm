"""Règles critiques commerciales : annulation de facture, remboursement d'avoir."""
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from apps.clients.models import Client
from apps.commercial.models import Avoir, Commande, Facture, LigneAvoir
from apps.produits.models import CategorieProduit, ProduitFini
from apps.tresorerie.models import Caisse
from apps.users.models import Utilisateur


def _admin():
    user = Utilisateur.objects.create_superuser(
        identifiant="admin-test", password="x",
        matricule="M-TEST", nom_complet="Admin Test",
    )
    return user


def _client():
    return Client.objects.create(nom_client="Client test", type_client=Client.TypeClient.SIMPLE)


def _facture_nue(client):
    return Facture.objects.create(
        num_facture=f"FAC-TEST-{Facture.objects.count() + 1}",
        montant_ht=Decimal("100000"), tva=Decimal("20000"),
        type_facturation=Facture.TypeFacturation.QUITTANCE,
        client=client,
    )


class AnnulerFactureTests(TestCase):
    def setUp(self):
        self.client_api = APIClient()
        self.client_api.force_authenticate(user=_admin())

    def test_annule_facture_non_payee(self):
        facture = _facture_nue(_client())
        rep = self.client_api.post(
            f"/api/commercial/factures/{facture.pk}/annuler/", {"motif": "doublon"})
        assert rep.status_code == 200, rep.content
        facture.refresh_from_db()
        assert facture.statut_paiement == Facture.StatutPaiement.ANNULEE
        assert facture.motif_annulation == "doublon"

    def test_refuse_facture_partiellement_payee(self):
        from apps.tresorerie.models import Reglement
        facture = _facture_nue(_client())
        Reglement.objects.create(
            mode_reglement=Reglement.Mode.ESPECES, montant_regle=Decimal("10000"),
            facture=facture,
        )
        facture.statut_paiement = Facture.StatutPaiement.PARTIELLE
        facture.save(update_fields=["statut_paiement"])
        rep = self.client_api.post(
            f"/api/commercial/factures/{facture.pk}/annuler/", {"motif": "trop tard"})
        assert rep.status_code == 400, rep.content

    def test_motif_obligatoire(self):
        facture = _facture_nue(_client())
        rep = self.client_api.post(f"/api/commercial/factures/{facture.pk}/annuler/", {})
        assert rep.status_code == 400, rep.content

    def test_commande_facturee_repasse_livree(self):
        client = Client.objects.create(
            nom_client="Privé test", type_client=Client.TypeClient.PRIVE)
        commande = Commande.objects.create(
            num_commande="CMD-TEST-1", client=client,
            statut_commande=Commande.Statut.FACTUREE,
        )
        facture = Facture.objects.create(
            num_facture="FAC-TEST-CMD", montant_ht=Decimal("50000"),
            tva=Decimal("10000"),
            type_facturation=Facture.TypeFacturation.QUITTANCE,
            commande=commande,
        )
        rep = self.client_api.post(
            f"/api/commercial/factures/{facture.pk}/annuler/", {"motif": "erreur"})
        assert rep.status_code == 200, rep.content
        commande.refresh_from_db()
        assert commande.statut_commande == Commande.Statut.LIVREE


class RembourserAvoirTests(TestCase):
    def setUp(self):
        self.client_api = APIClient()
        self.client_api.force_authenticate(user=_admin())
        categorie = CategorieProduit.objects.create(libelle_categorie="Cat test")
        self.produit = ProduitFini.objects.create(
            code_produit="P-TEST", designation="Produit test",
            prix_tarif=Decimal("10000"), categorie=categorie,
        )
        self.caisse = Caisse.objects.create(
            code_caisse="C-TEST-R", libelle_caisse="Caisse test",
            solde_actuel=Decimal("500000"),
        )

    def _avoir(self):
        facture = _facture_nue(_client())
        avoir = Avoir.objects.create(
            num_avoir=f"AV-TEST-{Avoir.objects.count() + 1}",
            motif="retour", facture=facture,
        )
        LigneAvoir.objects.create(
            avoir=avoir, produit=self.produit,
            quantite_retournee=2, montant_avoir=Decimal("20000"),
        )
        return avoir

    def test_rembourse_une_fois_avec_sortie_ttc(self):
        avoir = self._avoir()
        rep = self.client_api.post(
            f"/api/commercial/avoirs/{avoir.pk}/rembourser/",
            {"caisse": self.caisse.pk})
        assert rep.status_code == 200, rep.content
        avoir.refresh_from_db()
        self.caisse.refresh_from_db()
        assert avoir.statut_remboursement == Avoir.StatutRemboursement.REMBOURSE
        # 20000 HT + 20 % TVA = 24000 sortis de la caisse
        assert self.caisse.solde_actuel == Decimal("476000")

    def test_double_remboursement_refuse(self):
        avoir = self._avoir()
        url = f"/api/commercial/avoirs/{avoir.pk}/rembourser/"
        assert self.client_api.post(url, {"caisse": self.caisse.pk}).status_code == 200
        rep = self.client_api.post(url, {"caisse": self.caisse.pk})
        assert rep.status_code == 400, rep.content
