"""Recouvrement : historique des relances, blocage auto en contentieux."""
from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.clients.models import Client, SolvabiliteClient
from apps.commercial.models import Commande, Facture

from .models import Recouvrement, Relance


def _admin():
    from apps.users.models import Utilisateur
    return Utilisateur.objects.create_superuser(
        identifiant="admin-rec", password="x",
        matricule="M-REC", nom_complet="Admin Rec",
    )


def _dossier_echu():
    client = Client.objects.create(nom_client="Privé rec", type_client=Client.TypeClient.PRIVE)
    SolvabiliteClient.objects.update_or_create(
        client=client,
        defaults={'score_credit': Decimal("50"),
                  'plafond_encours': Decimal("1000000"),
                  'statut_blocage': SolvabiliteClient.BLOCAGE_ACTIF,
                  'blocage_auto': 0},
    )
    commande = Commande.objects.create(num_commande="CMD-REC-1", client=client)
    facture = Facture.objects.create(
        num_facture="FAC-REC-1", montant_ht=Decimal("100000"), tva=Decimal("20000"),
        type_facturation=Facture.TypeFacturation.VIREMENT_TRESOR,
        commande=commande,
        date_facture=timezone.now() - timedelta(days=60),
    )
    return client, facture


class HistoriqueRelancesTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.user = _admin()
        self.api.force_authenticate(user=self.user)
        _, facture = _dossier_echu()
        rep = self.api.post("/api/recouvrement/dossiers/", {"factures": [facture.pk]})
        assert rep.status_code == 201, rep.content
        self.dossier = Recouvrement.objects.get(pk=rep.data["id_recouvrement"])

    def test_ouverture_tracee(self):
        relances = Relance.objects.filter(dossier=self.dossier)
        assert relances.count() == 1
        r = relances.get()
        assert (r.nature, r.niveau) == (Relance.Nature.OUVERTURE, 1)
        assert r.auteur == self.user

    def test_relancer_trace_canal_commentaire_auteur(self):
        url = f"/api/recouvrement/dossiers/{self.dossier.pk}/relancer/"
        rep = self.api.post(url, {"canal": "email", "commentaire": "Promet de payer"})
        assert rep.status_code == 200, rep.content
        r = Relance.objects.filter(dossier=self.dossier).latest("pk")
        assert (r.nature, r.niveau) == (Relance.Nature.RELANCE, 1)
        assert r.canal == Relance.Canal.EMAIL
        assert r.commentaire == "Promet de payer"
        assert r.auteur == self.user

    def test_escalade_tracee_et_detail_expose_historique(self):
        url = f"/api/recouvrement/dossiers/{self.dossier.pk}/escalader/"
        rep = self.api.post(url, {"canal": "courrier", "commentaire": "Mise en demeure"})
        assert rep.status_code == 200, rep.content
        assert Relance.objects.filter(dossier=self.dossier).count() == 2
        detail = self.api.get(f"/api/recouvrement/dossiers/{self.dossier.pk}/").data
        assert len(detail["relances"]) == 2
        assert detail["relances"][0]["auteur_nom"] == "Admin Rec"

    def test_canal_invalide_refuse(self):
        url = f"/api/recouvrement/dossiers/{self.dossier.pk}/relancer/"
        rep = self.api.post(url, {"canal": "pigeon"})
        assert rep.status_code == 400, rep.content


class BlocageAutoTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.api.force_authenticate(user=_admin())
        self.client_prive, facture = _dossier_echu()
        rep = self.api.post("/api/recouvrement/dossiers/", {"factures": [facture.pk]})
        assert rep.status_code == 201, rep.content
        self.dossier = Recouvrement.objects.get(pk=rep.data["id_recouvrement"])
        self.url_esc = f"/api/recouvrement/dossiers/{self.dossier.pk}/escalader/"

    def test_contentieux_bloque_auto(self):
        assert self.api.post(self.url_esc, {}).status_code == 200
        assert self.api.post(self.url_esc, {}).status_code == 200
        dossier = Recouvrement.objects.get(pk=self.dossier.pk)
        assert dossier.statut_dossier == Recouvrement.Statut.CONTENTIEUX
        solv = SolvabiliteClient.objects.get(client=self.client_prive)
        assert solv.statut_blocage == SolvabiliteClient.BLOCAGE_BLOQUE
        assert solv.blocage_auto == 1

    def test_facture_refusee_client_bloque(self):
        self.test_contentieux_bloque_auto()
        commande2 = Commande.objects.create(
            num_commande="CMD-REC-2", client=self.client_prive,
            statut_commande=Commande.Statut.LIVREE,
        )
        rep = self.api.post("/api/commercial/factures/", {"commande": commande2.pk})
        assert rep.status_code == 400, rep.content
        assert "bloqu" in str(rep.content).lower() or "contentieux" in str(rep.content).lower()

    def test_solde_leve_blocage_auto(self):
        from apps.tresorerie.models import Reglement
        self.test_contentieux_bloque_auto()
        facture = self.dossier.lignes.first().facture
        Reglement.objects.create(
            mode_reglement=Reglement.Mode.VIREMENT_TRESOR,
            montant_regle=Decimal("120000"), num_virement_tresor="VIR-REC-1",
            facture=facture, statut=Reglement.Statut.ACTIF,
        )
        rep = self.api.post(f"/api/recouvrement/dossiers/{self.dossier.pk}/actualiser/", {})
        assert rep.status_code == 200, rep.content
        assert Recouvrement.objects.get(pk=self.dossier.pk).statut_dossier == "REGLE"
        solv = SolvabiliteClient.objects.get(client=self.client_prive)
        assert solv.statut_blocage == SolvabiliteClient.BLOCAGE_ACTIF
        assert solv.blocage_auto == 0

    def test_blocage_manuel_preserve(self):
        self.test_contentieux_bloque_auto()
        solv = SolvabiliteClient.objects.get(client=self.client_prive)
        solv.blocage_auto = 0  # le comptable s'approprie le blocage
        solv.save(update_fields=["blocage_auto"])
        from apps.tresorerie.models import Reglement
        facture = self.dossier.lignes.first().facture
        Reglement.objects.create(
            mode_reglement=Reglement.Mode.VIREMENT_TRESOR,
            montant_regle=Decimal("120000"), num_virement_tresor="VIR-REC-2",
            facture=facture, statut=Reglement.Statut.ACTIF,
        )
        self.api.post(f"/api/recouvrement/dossiers/{self.dossier.pk}/actualiser/", {})
        solv.refresh_from_db()
        assert solv.statut_blocage == SolvabiliteClient.BLOCAGE_BLOQUE
