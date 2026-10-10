"""
Catalogue RBAC du SIGCC — conforme cahier des charges §5.2.1 + MLD Bloc 7.
Deux familles de privilèges coexistent dans la table PRIVILEGE :
- CRUD API "<ressource>.<action>" (utilisé par HasPrivilege sur les ViewSets users)
- Métier MAJUSCULE (acteurs §5.2.1, vérifiés via user.has_privilege dans le futur métier)
Relancer : python manage.py seed_rbac
Mapping rôles DB -> acteurs spec :
  ADMIN=Administrateur Système, DIRECTION=Chef Service Ventes,
  RECEPTION=Responsable Réception, COMMERCIAL=Agent Commercial,
  MAGASINIER=Gestionnaire de Stock, CAISSIER=Caissier SFC,
  COMPTABLE=Comptable Public/SFC, RECOUVREMENT=subset recouvrement (rattaché COMPTABLE spec)
"""

CRUD = ('view', 'create', 'update', 'delete')


def crud(resource, label):
    return [
        (f'{resource}.{action}', f'{action.capitalize()} : {label}')
        for action in CRUD
    ]


def view_only(*resources):
    """Privilèges '<ressource>.view' pour chaque ressource (lecture seule)."""
    return [f'{res}.view' for res in resources]


# Ressources du catalogue produits & séries (étape 5)
PRODUITS_RES = ['categorie', 'produit', 'config_serie', 'lot']


PRIVILEGES = [
    *crud('utilisateur', 'utilisateurs'),
    *crud('role', 'rôles'),
    *crud('privilege', 'privilèges'),
    # Modules métier (vues à venir — privilèges pré-enregistrés pour seed Oracle)
    *crud('territoire', 'territoires'),
    *crud('province', 'provinces'),
    *crud('region', 'régions'),
    *crud('district', 'districts'),
    *crud('commune', 'communes'),
    *crud('fokontany', 'fokontany'),
    *crud('client', 'clients'),
    *crud('client_simple', 'clients du comptoir (réception)'),
    *crud('organisme', 'organismes'),
    *crud('solvabilite', 'solvabilités clients'),
    *crud('type_financement', 'types de financement'),
    *crud('budget', 'budgets'),
    *crud('ligne_budgetaire', 'lignes budgétaires'),
    *crud('prevision', 'prévisions budgétaires'),
    ('engagement.view', 'View : engagements budgétaires'),
    ('engagement.create', 'Create : engagements budgétaires'),
    ('engagement.update', 'Update : engagements budgétaires (dont annulation)'),
    *crud('commercial', 'documents commerciaux'),
    *crud('categorie', 'catégories de produits'),
    *crud('produit', 'produits'),
    *crud('config_serie', 'configurations de série'),
    ('lot.view', 'View : lots de lancement en série'),
    ('lot.create', 'Create : lots de lancement en série'),
    ('lot.update', 'Update : lots (démarrer, terminer, annuler)'),
    *crud('planification', 'planifications de besoins'),
    *crud('devis', 'devis proforma'),
    *crud('commande', 'commandes'),
    ('commande.valider', 'Valider : commandes'),
    *crud('preparation', 'préparations de commandes'),
    ('livraison.view', 'View : bons de livraison'),
    ('livraison.create', 'Create : bons de livraison'),
    ('facture.view', 'View : factures'),
    ('facture.create', 'Create : factures'),
    ('avoir.view', 'View : avoirs'),
    ('avoir.create', 'Create : avoirs'),
    *crud('stock', 'stocks'),
    *crud('magasin', 'magasins / dépôts'),
    *crud('emplacement', 'emplacements'),
    ('stock.view', 'View : niveaux de stock'),
    ('stock.transfer', 'Transfer : transferts entre emplacements'),
    ('reservation.view', 'View : réservations de stock'),
    ('reservation.create', 'Create : réservations de stock'),
    ('reservation.delete', 'Delete : libération de réservations'),
    ('mouvement.view', 'View : mouvements de stock'),
    ('mouvement.create', 'Create : mouvements manuels et retours en stock'),
    *crud('inventaire', 'inventaires physiques du stock'),
    ('inventaire.valider', 'Valider : inventaires (passe les ajustements)'),
    *crud('tresorerie', 'trésorerie'),
    # Étape 8 — Trésorerie (caisses, carnets de quittances, règlements, livre de caisse)
    *crud('caisse', 'caisses'),
    *crud('livre_quittance', 'carnets de quittances'),
    ('quittance.view', 'View : quittances'),
    ('reglement.view', 'View : règlements'),
    ('reglement.create', 'Create : règlements'),
    ('reglement.encaisser', 'Encaisser : espèces ou chèque au comptoir (avec quittance)'),
    ('reglement.virement', 'Enregistrer : virements du Trésor'),
    ('reglement.annuler', 'Annuler : contre-passer un règlement saisi par erreur'),
    ('facture.annuler', 'Annuler : factures non payées'),
    ('avoir.rembourser', 'Rembourser : avoirs au client (sortie de caisse)'),
    *crud('arrete_caisse', 'arrêtés de caisse journaliers'),
    ('arrete_caisse.valider', 'Valider : arrêtés de caisse (fige la journée)'),
    *crud('remise_banque', 'remises en banque'),
    ('remise_banque.remettre', 'Exécuter : remises en banque (sortie de caisse)'),
    ('etat.view', 'View : états financiers (journal, balance âgée, encaissements) et exports'),
    ('livre_caisse.view', 'View : livre de caisse'),
    ('livre_caisse.create', 'Create : opérations manuelles du livre de caisse'),
    *crud('recouvrement', 'recouvrements'),
    *crud('audit', "journaux d'audit"),
    # --- Privilèges métier §5.2.1 (code_action exacts du cahier des charges) ---
    # Responsable Réception
    ('CREER_CLIENT_SIMPLE', 'Créer un client SIMPLE au comptoir (réception)'),
    ('RECHERCHER_CLIENT', 'Rechercher un client'),
    ('CONSULTER_COMMUNE', 'Consulter les communes (référentiel territoire)'),
    # Agent Commercial
    ('CREER_CLIENT_CORPO', 'Créer un client corporatif (privé/public)'),
    ('EMETTRE_PROFORMA', 'Émettre un devis proforma'),
    ('SAISIR_COMMANDE', 'Saisir une commande'),
    ('GENERER_FACTURE', 'Générer une facture'),
    ('CONSULTER_STOCK', 'Consulter les stocks'),
    # Chef Service Ventes (= DIRECTION)
    ('VALIDER_PRIX_CATALOGUE', 'Valider les grilles de prix au catalogue'),
    ('APPROUVER_LANCEMENT_SERIE', 'Approuver un lancement de série sécurisée'),
    ('VALIDER_AVOIR', 'Valider un avoir'),
    ('CONSULTER_AUDIT_TRAIL', "Consulter la piste d'audit"),
    # Caissier SFC
    ('ENCAISSER_FONDS', 'Encaisser les fonds au comptoir'),
    ('REMPLIR_QUITTANCE_MATRICE', 'Remplir la quittance matrice SFC (Livre/Feuille 1-50/Volet A-E)'),
    ('OUVRIR_CAISSE', 'Ouvrir une caisse'),
    ('CONSULTER_LIVRE_CAISSE', 'Consulter le livre de caisse'),
    # Comptable Public / SFC
    ('VALIDER_ENGAGEMENT_BUDGET', 'Valider un engagement budgétaire (visa CF)'),
    ('ENREGISTRER_VIREMENT_TRESOR', 'Enregistrer un virement du Trésor'),
    ('DECLENCHER_RECOUVREMENT', 'Déclencher un recouvrement'),
    ('MODIFIER_PLAFOND_ENCOURS', "Modifier le plafond d'en-cours client"),
    # Gestionnaire de Stock
    ('CREER_PREPARATION', 'Créer une préparation de commande'),
    ('VALIDER_RESERVATION_STOCK', 'Valider une réservation de stock'),
    ('EMETTRE_BON_LIVRAISON', 'Émettre un bon de livraison'),
    ('AJUSTER_EMPLACEMENT', 'Ajuster un emplacement (allée/étagère)'),
    ('CONSIGNER_MOUVEMENT', 'Consigner un mouvement de stock'),
    # Administrateur Système
    ('CREER_UTILISATEUR', 'Créer un compte utilisateur'),
    ('AFFECTER_ROLE', 'Affecter un rôle à un utilisateur'),
    ('CONFIGUR_PRIVILEGE', 'Configurer les privilèges'),
    ('PURGER_RESERVATIONS_EXPIREES', 'Purger les réservations expirées'),
    ('audit.view', "View : journal d'audit"),
    ('statistiques.view', 'View : tableau de bord analytique'),
    # États financiers
    ('etat_ventes.view', 'View : état — journal des ventes'),
    ('etat_encaissements.view', 'View : état — encaissements'),
    ('etat_creances.view', 'View : état — balance âgée des créances'),
    ('etat_caisse.view', 'View : état — état de caisse'),
    ('etat_budget.view', 'View : état — situation budgétaire'),
    # Notifications
    ('notification.annoncer', 'Envoyer : annonces aux utilisateurs'),
]

# Rôles métiers (à adapter selon votre cahier des charges)
ROLES = [
    'ADMIN',          # accès total (bypass des privilèges)
    'DIRECTION',
    'RECEPTION',
    'COMMERCIAL',
    'MAGASINIER',
    'CAISSIER',
    'COMPTABLE',
    'RECOUVREMENT',
    'PRODUCTION',  
]

# Privilèges par rôle ('*' = tous). ADMIN est de toute façon en bypass.
# Base CRUD : gestion utilisateurs réservée à ADMIN (+ lecture pour DIRECTION).
# + Privilèges métier §5.2.1 exacts. RECOUVREMENT = subset dédié relances.
ROLE_PRIVILEGES = {
    'ADMIN': ['*'],
    'DIRECTION': [
        'utilisateur.view', 'role.view', 'privilege.view',
        'territoire.view', 'province.view', 'region.view',
        'district.view', 'commune.view', 'fokontany.view',
        'client.view', 'organisme.view', 'solvabilite.view', 'budget.view',
        'type_financement.view', 'ligne_budgetaire.view', 'prevision.view',
        'engagement.view',
        'commercial.view', 'produit.view', 'stock.view',
        'tresorerie.view', 'recouvrement.view', 'audit.view',
        *view_only('caisse', 'livre_quittance', 'quittance', 'reglement', 'livre_caisse',
                    'arrete_caisse', 'remise_banque'),
        'etat.view',
        *view_only('categorie', 'config_serie', 'lot'),
        *view_only('planification', 'devis', 'commande'),
        *view_only('preparation', 'livraison', 'facture', 'avoir'),
        *view_only('magasin', 'emplacement', 'stock', 'reservation', 'mouvement', 'inventaire'),
        'VALIDER_PRIX_CATALOGUE', 'APPROUVER_LANCEMENT_SERIE',
        'VALIDER_AVOIR', 'CONSULTER_AUDIT_TRAIL', 'etat_ventes.view', 'etat_encaissements.view', 'etat_creances.view', 'etat_caisse.view', 'etat_budget.view',
        'notification.annoncer',
    ],

    'RECEPTION': [
        'client_simple.view', 'client_simple.create', 'client_simple.update',
        *view_only('categorie', 'produit'),      # choix des produits d'une vente au comptoir
        'stock.view',                            # disponibilité avant la vente
        # Pas de facture.view ni livraison.view : la réception crée la vente
        # au comptoir (facture.create) puis le dossier part au caissier
        # (encaissement) et au magasinier (bon de livraison).
        'facture.create',                        # vente comptoir (écran F9)
    ],
    'COMMERCIAL': [
        'commercial.view', 'commercial.create', 'commercial.update',
        'client.view', 'client.create', 'client.update',
        'organisme.view', 'organisme.create', 'organisme.update',
        'solvabilite.view',
        'produit.view', 'territoire.view', 'province.view', 'region.view',
        'district.view', 'commune.view', 'fokontany.view',
        *view_only(*PRODUITS_RES),
        'categorie.create', 'categorie.update',
        'produit.create', 'produit.update',
        *view_only('planification', 'devis', 'commande'),
        'planification.create', 'planification.update',
        'devis.create', 'devis.update', 'devis.delete',
        'commande.create', 'commande.update', 'commande.delete',
        'commande.valider',
        *view_only('preparation', 'livraison', 'facture', 'avoir'),
        *view_only('magasin', 'emplacement', 'stock', 'reservation'),
        # Étape 9 : sait si un client est en recouvrement avant de lui vendre
        *view_only('recouvrement'),
        'CREER_CLIENT_CORPO', 'EMETTRE_PROFORMA', 'SAISIR_COMMANDE',
        'GENERER_FACTURE', 'CONSULTER_STOCK',
    ],
    'MAGASINIER': [
        'stock.view', 'stock.create', 'stock.update',
        'produit.view', 'produit.create', 'produit.update',
        'commercial.view', 'client.view',
        'organisme.view', 'solvabilite.view',
        'province.view', 'region.view', 'district.view',
        'commune.view', 'fokontany.view',
        *view_only('categorie', 'config_serie', 'lot'),
        *view_only('commande', 'facture'),
        'preparation.view', 'preparation.create', 'preparation.update',
        'preparation.delete',
        'livraison.view', 'livraison.create',
        *view_only('magasin', 'emplacement', 'stock', 'mouvement', 'reservation', 'avoir'),
        'inventaire.view', 'inventaire.create', 'inventaire.update', 'inventaire.delete',
        'inventaire.valider',
        'magasin.create', 'magasin.update',
        'emplacement.create', 'emplacement.update', 'emplacement.delete',
        'stock.transfer',
        'reservation.create', 'reservation.delete',
        'mouvement.create',
        'CREER_PREPARATION', 'VALIDER_RESERVATION_STOCK',
        'EMETTRE_BON_LIVRAISON', 'AJUSTER_EMPLACEMENT', 'CONSIGNER_MOUVEMENT',
    ],
    'CAISSIER': [
        'tresorerie.view', 'tresorerie.create',
        'caisse.view', 'caisse.create', 'caisse.update',
        'livre_quittance.view',
        'quittance.view',
        'reglement.view', 'reglement.create', 'reglement.encaisser',
        'reglement.annuler',
        'livre_caisse.view',
        'arrete_caisse.view', 'arrete_caisse.create', 'arrete_caisse.update',
        'arrete_caisse.valider',
        'remise_banque.view', 'remise_banque.create', 'remise_banque.remettre',
        'etat.view',
        'client.view', 'commercial.view', 'recouvrement.view',
        'organisme.view', 'solvabilite.view',
        'province.view', 'region.view', 'district.view',
        'commune.view', 'fokontany.view',
        *view_only('categorie', 'produit'),
        'facture.view',
        'ENCAISSER_FONDS', 'REMPLIR_QUITTANCE_MATRICE',
        'OUVRIR_CAISSE', 'CONSULTER_LIVRE_CAISSE',
        'etat_encaissements.view', 'etat_caisse.view',
    ],
    'COMPTABLE': [
        'budget.view', 'budget.create', 'budget.update',
        'type_financement.view', 'ligne_budgetaire.view', 'prevision.view',
        'ligne_budgetaire.create', 'ligne_budgetaire.update',
        'prevision.create', 'prevision.update',
        'engagement.view', 'engagement.create', 'engagement.update',
        'type_financement.view', 'type_financement.create', 'type_financement.update',
        'tresorerie.view', 'tresorerie.create', 'tresorerie.update',
        'caisse.view', 'caisse.create', 'caisse.update', 'caisse.delete',
        'livre_quittance.view', 'livre_quittance.create',
        'livre_quittance.update', 'livre_quittance.delete',
        'quittance.view',
        'reglement.view', 'reglement.create', 'reglement.virement',
        'reglement.annuler',
        'livre_caisse.view', 'livre_caisse.create',
        'arrete_caisse.view', 'arrete_caisse.create', 'arrete_caisse.update',
        'arrete_caisse.delete', 'arrete_caisse.valider',
        'remise_banque.view', 'remise_banque.create', 'remise_banque.update',
        'remise_banque.delete', 'remise_banque.remettre',
        'facture.annuler', 'avoir.rembourser', 'etat.view',
        # Étape 9 : déclenche et pilote le recouvrement (cahier des charges, chapitre V)
        *view_only('recouvrement'),
        'recouvrement.create', 'recouvrement.update',
        'commercial.view', 'audit.view',
        'client.view', 'organisme.view',
        'solvabilite.view', 'solvabilite.create', 'solvabilite.update',
        'province.view', 'region.view', 'district.view',
        'commune.view', 'fokontany.view',
        *view_only('categorie', 'produit'),
        *view_only('commande', 'planification', 'preparation', 'livraison'),
        'facture.view', 'facture.create', 'avoir.view', 'avoir.create',
        *view_only('magasin', 'emplacement', 'stock', 'reservation', 'mouvement'),
        'VALIDER_ENGAGEMENT_BUDGET', 'ENREGISTRER_VIREMENT_TRESOR',
        'DECLENCHER_RECOUVREMENT', 'MODIFIER_PLAFOND_ENCOURS', 
        'etat_ventes.view', 'etat_encaissements.view', 'etat_creances.view', 'etat_caisse.view', 'etat_budget.view',
    ],
    'RECOUVREMENT': [
        'recouvrement.view', 'recouvrement.create', 'recouvrement.update',
        'client.view', 'tresorerie.view', 'commercial.view',
        'caisse.view', 'livre_quittance.view',
        'quittance.view', 'reglement.view', 'livre_caisse.view',
        'organisme.view', 'solvabilite.view',
        'province.view', 'region.view', 'district.view',
        'commune.view', 'fokontany.view',
        *view_only('categorie', 'produit'),
        *view_only('commande'),
        'facture.view', 'avoir.view',
        'etat.view',
        'DECLENCHER_RECOUVREMENT', 'RECHERCHER_CLIENT', 'GENERER_FACTURE',
        'engagement.view', 'etat_creances.view', 'etat_encaissements.view',
    ],
    # Nouveau rôle
    'PRODUCTION': [
        *view_only('categorie', 'produit', 'config_serie', 'lot'),
        'config_serie.create', 'config_serie.update',
        'lot.create', 'lot.update',
        *view_only('commande', 'planification'),
        'preparation.view',
        *view_only('magasin', 'emplacement', 'stock'),
    ],
}