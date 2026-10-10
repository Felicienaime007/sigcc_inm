"""États financiers : JSON + exports CSV/Excel/PDF."""
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from apps.clients.models import Client
from apps.commercial.models import Facture
from apps.tresorerie.models import Caisse, Reglement
from apps.users.models import Utilisateur

ETATS = ["journal-ventes", "balance-agee", "encaissements"]


class EtatsTests(TestCase):
    def setUp(self):
        admin = Utilisateur.objects.create_superuser(
            identifiant="admin-etats", password="x",
            matricule="M-ETATS", nom_complet="Admin États",
        )
        self.api = APIClient()
        self.api.force_authenticate(user=admin)
        client = Client.objects.create(
            nom_client="Client états", type_client=Client.TypeClient.PRIVE)
        self.facture = Facture.objects.create(
            num_facture="FAC-ETATS-1", montant_ht=Decimal("100000"),
            tva=Decimal("20000"),
            type_facturation=Facture.TypeFacturation.VIREMENT_TRESOR,
            client=client,
        )
        Reglement.objects.create(
            mode_reglement=Reglement.Mode.VIREMENT_TRESOR,
            montant_regle=Decimal("60000"), num_virement_tresor="VIR-E-1",
            facture=self.facture,
        )
        self.facture.statut_paiement = Facture.StatutPaiement.PARTIELLE
        self.facture.save(update_fields=["statut_paiement"])
        Caisse.objects.create(code_caisse="C-ETATS", libelle_caisse="Caisse états")

    def test_json_200_et_contenu(self):
        journal = self.api.get("/api/editions/journal-ventes/").data
        assert journal["lignes"] and journal["total"]
        balance = self.api.get("/api/editions/balance-agee/").data
        assert balance["lignes"] and balance["total"]
        # Reste : 120000 - 60000 = 60000 présent dans la balance
        assert "60" in balance["total"]["Total dû"].replace(" ", "").replace(",", "")
        encaissements = self.api.get("/api/editions/encaissements/").data
        assert encaissements["lignes"] and encaissements["total"]

    def test_exports_200_bon_content_type(self):
        attendu = {
            "csv": "text/csv",
            "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "pdf": "application/pdf",
        }
        for etat in ETATS:
            for format_demande, content_type in attendu.items():
                rep = self.api.get(f"/api/editions/{etat}/?export={format_demande}")
                assert rep.status_code == 200, (etat, format_demande, rep.content[:200])
                assert content_type in rep["Content-Type"], (etat, rep["Content-Type"])
                assert len(rep.content) > 0
