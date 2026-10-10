"""Stock : inventaire physique, seuil d'alerte."""
from django.test import TestCase
from rest_framework.test import APIClient

from apps.produits.models import CategorieProduit, ProduitFini
from apps.users.models import Utilisateur

from .models import (
    Emplacement, Inventaire, LigneInventaire, LigneStock, MagasinDepot,
    MouvementStock,
)
from .services import demarrer_inventaire, valider_inventaire


def _admin():
    return Utilisateur.objects.create_superuser(
        identifiant="admin-stock", password="x",
        matricule="M-STOCK", nom_complet="Admin Stock",
    )


def _magasin_produit(qte=10):
    magasin = MagasinDepot.objects.create(nom_magasin="Dépôt test", code_depot="DEP-T")
    emplacement = Emplacement.objects.create(
        code_allee="A1", code_etagere="E1", magasin=magasin)
    categorie = CategorieProduit.objects.create(libelle_categorie="Cat inv")
    produit = ProduitFini.objects.create(
        code_produit="P-INV", designation="Produit inv",
        prix_tarif=1000, categorie=categorie, seuil_alerte=15,
    )
    LigneStock.objects.create(
        emplacement=emplacement, produit=produit, quantite_physique=qte)
    return magasin, emplacement, produit


class InventaireTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.api.force_authenticate(user=_admin())
        self.magasin, self.emplacement, self.produit = _magasin_produit()

    def test_cycle_complet_avec_ecart_negatif(self):
        inv = Inventaire.objects.create(
            code_inventaire="INV-T1", magasin=self.magasin)
        demarrer_inventaire(inv)
        inv.refresh_from_db()
        assert inv.statut == Inventaire.Statut.EN_COURS
        ligne = LigneInventaire.objects.get(inventaire=inv)
        assert ligne.quantite_theorique == 10
        # Comptage : il manque 2 unités
        ligne.quantite_comptee = 8
        ligne.save(update_fields=["quantite_comptee"])
        valider_inventaire(inv)
        inv.refresh_from_db()
        assert inv.statut == Inventaire.Statut.VALIDE
        assert inv.date_fin is not None
        assert LigneStock.objects.get(
            emplacement=self.emplacement, produit=self.produit,
        ).quantite_physique == 8
        assert MouvementStock.objects.filter(
            type_mouvement=MouvementStock.Type.SORTIE_AJUSTEMENT,
            reference="INV-T1", quantite_mouv=2,
        ).count() == 1

    def test_validation_refusee_si_comptage_incomplet(self):
        from rest_framework.exceptions import ValidationError
        inv = Inventaire.objects.create(
            code_inventaire="INV-T2", magasin=self.magasin)
        demarrer_inventaire(inv)
        try:
            valider_inventaire(inv)
        except ValidationError:
            pass
        else:
            self.fail("Un comptage incomplet aurait dû être refusé.")

    def test_api_demarrer_valider(self):
        rep = self.api.post("/api/stock/inventaires/", {"magasin": self.magasin.pk})
        assert rep.status_code == 201, rep.content
        inv_id = rep.data["id_inventaire"]
        assert self.api.post(f"/api/stock/inventaires/{inv_id}/demarrer/").status_code == 200
        ligne = LigneInventaire.objects.get(inventaire_id=inv_id)
        rep = self.api.patch(
            f"/api/stock/lignes-inventaire/{ligne.pk}/", {"quantite_comptee": 12})
        assert rep.status_code == 200, rep.content
        assert rep.data["ecart"] == 2
        rep = self.api.post(f"/api/stock/inventaires/{inv_id}/valider/")
        assert rep.status_code == 200, rep.content
        assert LigneStock.objects.get(
            emplacement=self.emplacement, produit=self.produit,
        ).quantite_physique == 12
        assert MouvementStock.objects.filter(
            type_mouvement=MouvementStock.Type.ENTREE_AJUSTEMENT,
            reference=Inventaire.objects.get(pk=inv_id).code_inventaire,
        ).count() == 1


class SeuilAlerteTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.api.force_authenticate(user=_admin())
        _, _, self.produit = _magasin_produit(qte=10)

    def test_resume_signale_sous_seuil(self):
        # Disponible 10 <= seuil 15 → en alerte
        resume = self.api.get("/api/stock/lignes/resume/").data
        ligne = next(l for l in resume if l["produit"] == self.produit.pk)
        assert ligne["seuil_alerte"] == 15
        assert ligne["en_alerte"] is True
        alertes = self.api.get("/api/stock/lignes/resume/?alerte=true").data
        assert {l["produit"] for l in alertes} == {self.produit.pk}

    def test_seuil_modifiable_produit(self):
        rep = self.api.patch(
            f"/api/produits/{self.produit.pk}/", {"seuil_alerte": 5})
        assert rep.status_code == 200, rep.content
        resume = self.api.get("/api/stock/lignes/resume/").data
        ligne = next(l for l in resume if l["produit"] == self.produit.pk)
        assert ligne["en_alerte"] is False
