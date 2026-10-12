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

    def test_commande_facturee_sans_prepa_repasse_validee(self):
        # Privé facturé avant livraison : sans préparation, retour à VALIDEE.
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
        assert commande.statut_commande == Commande.Statut.VALIDEE

    def test_commande_livree_repasse_livree(self):
        from apps.commercial.models import PreparationCommande
        client = Client.objects.create(
            nom_client="Privé livré", type_client=Client.TypeClient.PRIVE)
        commande = Commande.objects.create(
            num_commande="CMD-TEST-2", client=client,
            statut_commande=Commande.Statut.FACTUREE,
        )
        preparation = PreparationCommande.objects.create(
            commande=commande, statut_prepa=PreparationCommande.Statut.LIVREE)
        from apps.commercial.models import BonLivraison
        BonLivraison.objects.create(num_bl="BL-TEST-1", preparation=preparation)
        facture = Facture.objects.create(
            num_facture="FAC-TEST-CMD-2", montant_ht=Decimal("50000"),
            tva=Decimal("10000"),
            type_facturation=Facture.TypeFacturation.QUITTANCE,
            commande=commande,
        )
        rep = self.client_api.post(
            f"/api/commercial/factures/{facture.pk}/annuler/", {"motif": "erreur"})
        assert rep.status_code == 200, rep.content
        commande.refresh_from_db()
        assert commande.statut_commande == Commande.Statut.LIVREE

    def test_commande_en_preparation_repasse_en_preparation(self):
        from apps.commercial.models import PreparationCommande
        client = Client.objects.create(
            nom_client="Privé prép", type_client=Client.TypeClient.PRIVE)
        commande = Commande.objects.create(
            num_commande="CMD-TEST-3", client=client,
            statut_commande=Commande.Statut.FACTUREE,
        )
        PreparationCommande.objects.create(
            commande=commande, statut_prepa=PreparationCommande.Statut.PRETE)
        facture = Facture.objects.create(
            num_facture="FAC-TEST-CMD-3", montant_ht=Decimal("50000"),
            tva=Decimal("10000"),
            type_facturation=Facture.TypeFacturation.QUITTANCE,
            commande=commande,
        )
        rep = self.client_api.post(
            f"/api/commercial/factures/{facture.pk}/annuler/", {"motif": "erreur"})
        assert rep.status_code == 200, rep.content
        commande.refresh_from_db()
        assert commande.statut_commande == Commande.Statut.EN_PREPARATION


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


class FacturePriveAvantLivraisonTests(TestCase):
    """Client privé : la commande est facturée avant d'être livrée."""

    def setUp(self):
        self.client_api = APIClient()
        self.client_api.force_authenticate(user=_admin())
        categorie = CategorieProduit.objects.create(libelle_categorie="Cat prive")
        self.produit = ProduitFini.objects.create(
            code_produit="P-PRIVE", designation="Produit privé",
            prix_tarif=Decimal("10000"), categorie=categorie,
        )
        self.prive = Client.objects.create(
            nom_client="Privé flux", type_client=Client.TypeClient.PRIVE)

    def _commande(self, statut=Commande.Statut.VALIDEE, client=None):
        from apps.commercial.models import LigneCommande
        client = client if client is not None else self.prive
        cmd = Commande.objects.create(
            num_commande=f"CMD-PRIVE-{Commande.objects.count() + 1}",
            client=client, statut_commande=statut,
        )
        LigneCommande.objects.create(
            commande=cmd, produit=self.produit,
            quantite_commandee=3, prix_unitaire_facture=Decimal("10000"))
        return cmd

    def test_facture_depuis_validee_reprend_lignes_commande(self):
        cmd = self._commande()
        rep = self.client_api.post("/api/commercial/factures/", {"commande": cmd.pk})
        assert rep.status_code == 201, rep.content
        cmd.refresh_from_db()
        assert cmd.statut_commande == Commande.Statut.FACTUREE
        facture = Facture.objects.get(num_facture=rep.data["num_facture"])
        assert facture.montant_ht == Decimal("30000")
        assert facture.tva == Decimal("6000")
        lignes = list(facture.lignes.all())
        assert len(lignes) == 1
        assert lignes[0].quantite_facturee == 3
        assert lignes[0].prix_unitaire == Decimal("10000")

    def test_double_facturation_refusee(self):
        cmd = self._commande()
        assert self.client_api.post(
            "/api/commercial/factures/", {"commande": cmd.pk}).status_code == 201
        rep = self.client_api.post("/api/commercial/factures/", {"commande": cmd.pk})
        assert rep.status_code == 400, rep.content

    def test_commande_brouillon_refusee(self):
        cmd = self._commande(statut=Commande.Statut.BROUILLON)
        rep = self.client_api.post("/api/commercial/factures/", {"commande": cmd.pk})
        assert rep.status_code == 400, rep.content

    def test_preparation_depuis_facturee_puis_livraison(self):
        from apps.commercial.models import PreparationCommande
        from apps.stock.models import Emplacement, LigneStock, MagasinDepot
        magasin = MagasinDepot.objects.create(
            nom_magasin="Dépôt privé", code_depot="DEP-P")
        emplacement = Emplacement.objects.create(
            code_allee="A1", code_etagere="E1", magasin=magasin)
        LigneStock.objects.create(
            emplacement=emplacement, produit=self.produit, quantite_physique=10)
        cmd = self._commande()
        assert self.client_api.post(
            "/api/commercial/factures/", {"commande": cmd.pk}).status_code == 201
        # Préparation possible depuis FACTUREE : la commande reste FACTUREE.
        rep = self.client_api.post(
            "/api/commercial/preparations/", {"commande": cmd.pk})
        assert rep.status_code == 201, rep.content
        cmd.refresh_from_db()
        assert cmd.statut_commande == Commande.Statut.FACTUREE
        prep = PreparationCommande.objects.get(commande=cmd)
        prep.statut_prepa = PreparationCommande.Statut.PRETE
        prep.save(update_fields=["statut_prepa"])
        rep = self.client_api.post(
            "/api/commercial/livraisons/", {"preparation": prep.pk})
        assert rep.status_code == 201, rep.content
        cmd.refresh_from_db()
        assert cmd.statut_commande == Commande.Statut.FACTUREE

    def test_livraison_sans_facture_refusee_prive(self):
        from apps.commercial.models import PreparationCommande
        cmd = self._commande(statut=Commande.Statut.EN_PREPARATION)
        prep = PreparationCommande.objects.create(
            commande=cmd, statut_prepa=PreparationCommande.Statut.PRETE)
        rep = self.client_api.post(
            "/api/commercial/livraisons/", {"preparation": prep.pk})
        assert rep.status_code == 400, rep.content
