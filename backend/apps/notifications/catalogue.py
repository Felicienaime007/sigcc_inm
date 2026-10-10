"""Types de notifications : libellé, destinataires par défaut, niveau."""

TYPES = {
    'vente.a_encaisser': {
        'libelle': "Nouvelle vente à encaisser",
        'description': "Une vente au comptoir vient d'être facturée par la réception.",
        'roles': ['CAISSIER'], 'niveau': 'INFO',
    },
    'vente.a_livrer': {
        'libelle': "Vente comptoir payée, à livrer",
        'description': "Le client a payé à la caisse : les produits peuvent lui être remis.",
        'roles': ['MAGASINIER'], 'niveau': 'INFO',
    },
    'vente.payee': {
        'libelle': "Vente comptoir encaissée",
        'description': "Une vente enregistrée à la réception vient d'être payée.",
        'roles': ['RECEPTION'], 'niveau': 'INFO',
    },
    'commande.a_preparer': {
        'libelle': "Commande validée, à préparer",
        'description': "Une commande vient d'être validée par le service commercial.",
        'roles': ['MAGASINIER'], 'niveau': 'INFO',
    },
    'commande.livree': {
        'libelle': "Commande livrée, à facturer",
        'description': "Une commande a été livrée et peut être facturée.",
        'roles': ['COMPTABLE'], 'niveau': 'INFO',
    },
    'lot.a_demarrer': {
        'libelle': "Nouveau lot de production à démarrer",
        'description': "Un lot numéroté vient d'être lancé.",
        'roles': ['PRODUCTION'], 'niveau': 'INFO',
    },
    'lot.termine': {
        'libelle': "Lot terminé pour une commande",
        'description': "Un lot lié à une préparation est terminé et entré en stock.",
        'roles': ['MAGASINIER'], 'niveau': 'INFO',
    },
    'engagement.vise': {
        'libelle': "Engagement budgétaire visé",
        'description': "Un nouvel engagement du Contrôle financier est disponible pour un SOA.",
        'roles': ['COMMERCIAL'], 'niveau': 'INFO',
    },
    'client.bloque': {
        'libelle': "Client privé bloqué",
        'description': "Un client privé vient d'être bloqué : ses commandes ne peuvent plus être validées.",
        'roles': ['COMMERCIAL', 'COMPTABLE'], 'niveau': 'ATTENTION',
    },
    'recouvrement.contentieux': {
        'libelle': "Dossier passé en contentieux",
        'description': "Un dossier de recouvrement vient d'atteindre le niveau 3.",
        'roles': ['DIRECTION', 'COMPTABLE'], 'niveau': 'URGENT',
    },
    'carnet.bientot_epuise': {
        'libelle': "Carnet de quittances bientôt épuisé",
        'description': "Il reste 25, 10 puis 3 volets sur un carnet en cours.",
        'roles': ['CAISSIER', 'COMPTABLE'], 'niveau': 'ATTENTION',
    },
    'reglement.annule': {
        'libelle': "Règlement contre-passé",
        'description': "Un règlement saisi par erreur vient d'être annulé (la quittance est annulée avec lui).",
        'roles': ['CAISSIER', 'COMPTABLE', 'DIRECTION'], 'niveau': 'ATTENTION',
    },
    'caisse.ecart': {
        'libelle': "Arrêté de caisse avec écart",
        'description': "Une journée de caisse a été clôturée avec un écart entre le montant compté et le solde théorique.",
        'roles': ['COMPTABLE', 'DIRECTION'], 'niveau': 'ATTENTION',
    },
    'stock.rupture': {
        'libelle': "Produits en rupture de stock",
        'description': "Rappel quotidien des produits dont rien n'est disponible.",
        'roles': ['MAGASINIER'], 'niveau': 'ATTENTION',
    },
    'facture.echue': {
        'libelle': "Factures privées échues sans dossier",
        'description': "Rappel quotidien des impayés à mettre en recouvrement.",
        'roles': ['RECOUVREMENT'], 'niveau': 'ATTENTION',
    },
    'recouvrement.a_relancer': {
        'libelle': "Dossiers à relancer",
        'description': "Dossiers en cours sans relance depuis plusieurs jours.",
        'roles': ['RECOUVREMENT'], 'niveau': 'ATTENTION',
    },
    'annonce': {
        'libelle': "Annonces",
        'description': "Messages envoyés par la direction ou l'administration.",
        'roles': [], 'niveau': 'INFO', 'obligatoire': True,
    },
}