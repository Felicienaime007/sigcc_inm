from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from apps.commercial.models import Avoir, BonLivraison, Commande, DevisProforma, Facture
from apps.editions import documents as d
from apps.editions.lettres import montant_en_lettres
from apps.recouvrement.models import Recouvrement
from apps.tresorerie.models import Reglement
from apps.users.models import Utilisateur

ATTENDUS = {
    0: "Zéro ariary", 71: "Soixante et onze ariary", 80: "Quatre-vingts ariary",
    91: "Quatre-vingt-onze ariary", 200: "Deux cents ariary", 201: "Deux cent un ariary",
    1_000: "Mille ariary", 21_000: "Vingt et un mille ariary", 80_000: "Quatre-vingt mille ariary",
    216_000: "Deux cent seize mille ariary", 505_000: "Cinq cent cinq mille ariary",
    1_340_000: "Un million trois cent quarante mille ariary",
    1_608_000: "Un million six cent huit mille ariary", 2_000_000: "Deux millions ariary",
    80_000_000: "Quatre-vingts millions ariary",
}


class Command(BaseCommand):
    help = "Vérifie les montants en lettres et génère un exemplaire PDF de chaque édition."

    def add_arguments(self, parser):
        parser.add_argument('--dossier', default='exemples_pdf', help="Dossier de sortie (défaut : exemples_pdf).")

    def handle(self, *args, **options):
        erreurs = [(n, montant_en_lettres(n), attendu) for n, attendu in ATTENDUS.items()
                   if montant_en_lettres(n) != attendu]
        for n, obtenu, attendu in erreurs:
            self.stdout.write(self.style.ERROR(f"  {n} : « {obtenu} » au lieu de « {attendu} »"))
        if erreurs:
            raise CommandError("Montants en lettres incorrects.")
        self.stdout.write(self.style.SUCCESS(f"{len(ATTENDUS)} montants en lettres vérifiés."))

        user = Utilisateur.objects.filter(identifiant='admin').first() or Utilisateur.objects.first()
        if user is None:
            raise CommandError("Aucun utilisateur en base.")
        sortie = Path(options['dossier'])
        sortie.mkdir(parents=True, exist_ok=True)

        def dernier(modele, **filtre):
            return modele.objects.filter(**filtre).order_by('-pk').first()

        elements = [
            ("devis", dernier(DevisProforma), d.pdf_devis),
            ("commande", dernier(Commande), d.pdf_commande),
            ("livraison", dernier(BonLivraison), d.pdf_livraison),
            ("facture", dernier(Facture), d.pdf_facture),
            ("avoir", dernier(Avoir), d.pdf_avoir),
            ("recu", dernier(Reglement), d.pdf_recu),
        ]
        for nom, obj, fabrique in elements:
            if obj is None:
                self.stdout.write(self.style.WARNING(f"  {nom} : aucune donnée, ignoré."))
                continue
            (sortie / f"{nom}.pdf").write_bytes(fabrique(obj, user))
            self.stdout.write(f"  {nom}.pdf")

        dossier = Recouvrement.objects.exclude(statut_dossier='REGLE').order_by('-pk').first()
        if dossier is None:
            self.stdout.write(self.style.WARNING("  relance : aucun dossier actif, ignoré."))
        else:
            for niveau in (1, 2, 3):
                (sortie / f"relance_niveau{niveau}.pdf").write_bytes(d.pdf_relance(dossier, user, niveau))
                self.stdout.write(f"  relance_niveau{niveau}.pdf")
        self.stdout.write(self.style.SUCCESS(f"Documents écrits dans {sortie.resolve()}"))