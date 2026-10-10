"""Règles critiques de trésorerie : contre-passation, arrêté, remise en banque."""
from decimal import Decimal

from django.test import TestCase
from rest_framework.exceptions import ValidationError

from apps.clients.models import Client
from apps.commercial.models import Facture

from .models import (
    ArreteCaisse, Caisse, LivreCaisse, LivreQuittance, Quittance, Reglement,
    RemiseBanque,
)
from .services import (
    contrepasser_reglement, journee_cloturee, remettre_en_banque, reste_a_payer,
    total_regle, valider_arrete,
)


def _client():
    return Client.objects.create(nom_client="Client test", type_client=Client.TypeClient.SIMPLE)


def _facture(client, ht="100000", tva="20000"):
    return Facture.objects.create(
        num_facture=f"FAC-TEST-{Facture.objects.count() + 1}",
        montant_ht=Decimal(ht), tva=Decimal(tva),
        type_facturation=Facture.TypeFacturation.QUITTANCE,
        client=client,
    )


def _caisse(solde="100000"):
    return Caisse.objects.create(
        code_caisse=f"C-TEST-{Caisse.objects.count() + 1}",
        libelle_caisse="Caisse test", solde_actuel=Decimal(solde),
    )


def _livre():
    return LivreQuittance.objects.create(
        numero_livre=f"L-TEST-{LivreQuittance.objects.count() + 1}", annee_ouverture=2026
    )


def _encaisser(facture, caisse, livre, montant="50000"):
    montant = Decimal(montant)
    reglement = Reglement.objects.create(
        mode_reglement=Reglement.Mode.ESPECES, montant_regle=montant, facture=facture
    )
    Quittance.objects.create(
        livre=livre, num_feuille=1, attribut_volet="A",
        reglement=reglement, caisse=caisse,
    )
    caisse.solde_actuel += montant
    caisse.save(update_fields=["solde_actuel"])
    LivreCaisse.objects.create(
        type_operation=LivreCaisse.Type.ENTREE, montant_op=montant,
        caisse=caisse, reglement=reglement,
        reference=facture.num_facture,
    )
    facture.statut_paiement = Facture.StatutPaiement.PARTIELLE
    facture.save(update_fields=["statut_paiement"])
    return reglement


class ContrePassationTests(TestCase):
    def test_contrepassation_restaure_solde_et_reste(self):
        client, facture, caisse, livre = _client(), None, None, None
        facture = _facture(client)
        caisse = _caisse()
        livre = _livre()
        reglement = _encaisser(facture, caisse, livre)

        contrepasser_reglement(reglement, "montant saisi deux fois")

        reglement.refresh_from_db()
        facture.refresh_from_db()
        caisse.refresh_from_db()
        assert reglement.statut == Reglement.Statut.ANNULE
        assert reglement.motif_annulation == "montant saisi deux fois"
        assert reglement.date_annulation is not None
        assert caisse.solde_actuel == Decimal("100000")  # sortie compensatoire
        assert total_regle(facture) == Decimal("0")
        assert reste_a_payer(facture) == Decimal("120000")
        assert facture.statut_paiement == Facture.StatutPaiement.NON_PAYEE
        assert LivreCaisse.objects.filter(
            type_operation=LivreCaisse.Type.SORTIE,
            reference__startswith="CONTRE-PASSATION",
        ).count() == 1
        # La quittance reste tracée, le volet n'est pas réutilisable
        assert Quittance.objects.filter(reglement=reglement).count() == 1
        # ... et elle est marquée ANNULEE
        quittance = Quittance.objects.get(reglement=reglement)
        assert quittance.statut == Quittance.Statut.ANNULEE

    def test_double_annulation_refusee(self):
        facture = _facture(_client())
        caisse, livre = _caisse(), _livre()
        reglement = _encaisser(facture, caisse, livre)
        contrepasser_reglement(reglement, "erreur")
        try:
            contrepasser_reglement(reglement, "encore")
        except ValidationError:
            pass
        else:
            self.fail("La double annulation aurait dû être refusée.")

    def test_motif_obligatoire(self):
        facture = _facture(_client())
        reglement = _encaisser(facture, _caisse(), _livre())
        try:
            contrepasser_reglement(reglement, "  ")
        except ValidationError:
            pass
        else:
            self.fail("Un motif vide aurait dû être refusé.")

    def test_virement_sans_mouvement_de_caisse(self):
        client = _client()
        facture = _facture(client)
        caisse = _caisse()
        reglement = Reglement.objects.create(
            mode_reglement=Reglement.Mode.VIREMENT_TRESOR, montant_regle=Decimal("120000"),
            num_virement_tresor="VIR-TEST-1", facture=facture,
        )
        facture.statut_paiement = Facture.StatutPaiement.PAYEE
        facture.save(update_fields=["statut_paiement"])

        contrepasser_reglement(reglement, "mauvais SOA")

        facture.refresh_from_db()
        caisse.refresh_from_db()
        assert total_regle(facture) == Decimal("0")
        assert facture.statut_paiement == Facture.StatutPaiement.NON_PAYEE
        assert caisse.solde_actuel == Decimal("100000")  # inchangé
        assert LivreCaisse.objects.count() == 0


class ArreteCaisseTests(TestCase):
    def test_validation_calcule_ecart_et_fige(self):
        from django.utils import timezone
        caisse = _caisse(solde="150000")
        LivreCaisse.objects.create(
            type_operation=LivreCaisse.Type.ENTREE, montant_op=Decimal("50000"),
            caisse=caisse, reference="test",
        )
        arrete = ArreteCaisse.objects.create(
            caisse=caisse, date_arrete=timezone.localdate(),
            montant_compte=Decimal("149000"),
        )
        valider_arrete(arrete)
        arrete.refresh_from_db()
        assert arrete.statut == ArreteCaisse.Statut.VALIDE
        assert arrete.total_entrees == Decimal("50000")
        assert arrete.solde_theorique == Decimal("150000")
        assert arrete.ecart == Decimal("-1000")
        assert journee_cloturee(caisse, timezone.now())

    def test_double_validation_refusee(self):
        arrete = ArreteCaisse.objects.create(caisse=_caisse(), montant_compte=Decimal("0"))
        valider_arrete(arrete)
        try:
            valider_arrete(arrete)
        except ValidationError:
            pass
        else:
            self.fail("La double validation aurait dû être refusée.")


class ComptageCoupuresTests(TestCase):
    def test_comptage_coherent_accepte(self):
        from .serializers import valider_comptage
        valider_comptage('{"20000": 2, "1000": 3}', Decimal("43000"))

    def test_total_incoherent_refuse(self):
        from .serializers import valider_comptage
        try:
            valider_comptage('{"20000": 1}', Decimal("43000"))
        except ValidationError:
            pass
        else:
            self.fail("Un total incohérent aurait dû être refusé.")

    def test_coupure_inconnue_refusee(self):
        from .serializers import valider_comptage
        try:
            valider_comptage('{"99999": 1}', Decimal("99999"))
        except ValidationError:
            pass
        else:
            self.fail("Une coupure inconnue aurait dû être refusée.")

    def test_quantite_negative_refusee(self):
        from .serializers import valider_comptage
        try:
            valider_comptage('{"1000": -1}', Decimal("-1000"))
        except ValidationError:
            pass
        else:
            self.fail("Une quantité négative aurait dû être refusée.")

    def test_texte_libre_historique_accepte(self):
        from .serializers import valider_comptage
        valider_comptage("12x10000, 5x5000", Decimal("1"))
        valider_comptage(None, Decimal("0"))


class RemiseBanqueTests(TestCase):
    def test_remise_decremente_et_trace(self):
        caisse = _caisse()
        remise = RemiseBanque.objects.create(
            caisse=caisse, montant=Decimal("40000"),
            reference_bordereau="RB-TEST-1", modes="ESPECES",
        )
        remettre_en_banque(remise)
        remise.refresh_from_db()
        caisse.refresh_from_db()
        assert remise.statut == RemiseBanque.Statut.REMISE
        assert caisse.solde_actuel == Decimal("60000")
        assert LivreCaisse.objects.filter(reference="REMISE BANQUE RB-TEST-1").count() == 1

    def test_remise_superieure_au_solde_refusee(self):
        remise = RemiseBanque.objects.create(
            caisse=_caisse(solde="1000"), montant=Decimal("5000"),
            reference_bordereau="RB-TEST-2",
        )
        try:
            remettre_en_banque(remise)
        except ValidationError:
            pass
        else:
            self.fail("Une remise supérieure au solde aurait dû être refusée.")

    def test_remise_liee_a_un_arrete(self):
        from django.utils import timezone
        caisse = _caisse()
        arrete = ArreteCaisse.objects.create(
            caisse=caisse, date_arrete=timezone.localdate(),
            montant_compte=Decimal("100000"),
            detail_billets='{"20000": 5}',
        )
        remise = RemiseBanque.objects.create(
            caisse=caisse, montant=Decimal("40000"),
            reference_bordereau="RB-TEST-3", modes="ESPECES",
            arrete=arrete,
        )
        assert remise.arrete_id == arrete.pk
        assert [r.reference_bordereau for r in arrete.remises.all()] == ["RB-TEST-3"]
        remettre_en_banque(remise)
        remise.refresh_from_db()
        assert remise.statut == RemiseBanque.Statut.REMISE
