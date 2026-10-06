# MODÈLE LOGIQUE DE DONNÉES (MLD) RELATIONNEL - SIGCC (INM)
## SYSTÈME INTÉGRÉ DE GESTION DU CYCLE COMMERCIAL DE L'IMPRIMERIE NATIONALE DE MADAGASCAR

---

## 🌐 Bloc 1 : Administration & Découpage Territorial

* **`PROVINCE`** (
    **`id_province`** INT [PK], 
    `nom_province` VARCHAR(100) NOT NULL
)

* **`REGION`** (
    **`id_region`** INT [PK], 
    `nom_region` VARCHAR(100) NOT NULL, 
    #`id_province` INT [FK] NOT NULL
)

* **`DISTRICT`** (
    **`id_district`** INT [PK], 
    `nom_district` VARCHAR(100) NOT NULL, 
    #`id_region` INT [FK] NOT NULL
)

* **`COMMUNE`** (
    **`id_commune`** INT [PK], 
    `nom_commune` VARCHAR(100) NOT NULL, 
    `type_commune` VARCHAR(20) NOT NULL,
    #`id_district` INT [FK] NOT NULL
)

* **`FOKONTANY`** (
    **`id_fokontany`** INT [PK], 
    `nom_fokontany` VARCHAR(100) NOT NULL, 
    #`id_commune` INT [FK] NOT NULL
)

* **`ORGANISME`** (
    **`id_organisme`** INT [PK], 
    `nom_organisme` VARCHAR(150) NOT NULL, 
    `code_institutionnel` VARCHAR(50) UNIQUE NOT NULL
)

---

## 👥 Bloc 2 : Clients & Profils Commerciaux

* **`CLIENT`** (
    **`id_client`** INT [PK], 
    `code_soa` VARCHAR(50) NULL, 
    `nom_client` VARCHAR(150) NOT NULL, 
    `type_client` VARCHAR(20) NOT NULL, *(CHECK: 'MINISTERE', 'CTD', 'PRIVE', 'SIMPLE')*
    `adresse` TEXT NULL, 
    `telephone` VARCHAR(30) NULL, 
    `cin_ou_nif` VARCHAR(50) NULL, 
    #`id_fokontany` INT [FK] NOT NULL, 
    #`id_organisme` INT [FK] NULL
)

* **`SOLVABILITE_CLIENT`** (
    **`id_solvabilite`** INT [PK], 
    `score_credit` DECIMAL(5,2) NOT NULL, 
    `plafond_encours` DECIMAL(15,2) NOT NULL, 
    `statut_blocage` BOOLEAN DEFAULT FALSE, 
    #`id_client` INT [FK] UNIQUE NOT NULL
)

---

## 💰 Bloc 3 : Finances Publiques & Budgets

* **`TYPE_FINANCEMENT`** (
    **`id_type_financement`** INT [PK], 
    `libelle_financement` VARCHAR(100) NOT NULL
)

* **`BUDGET`** (
    **`id_budget`** INT [PK], 
    `annee_budgetaire` INT NOT NULL, 
    `montant_alloue` DECIMAL(15,2) NOT NULL, 
    #`id_organisme` INT [FK] NOT NULL
)

* **`LIGNE_BUDGETAIRE`** (
    **`id_ligne_budget`** INT [PK], 
    `code_article` VARCHAR(50) NOT NULL, 
    `libelle_ligne` VARCHAR(255) NOT NULL, 
    `montant_disponible` DECIMAL(15,2) NOT NULL, 
    #`id_budget` INT [FK] NOT NULL, 
    #`id_type_financement` INT [FK] NULL
)

* **`PREVISION_BUDGETAIRE`** (
    **`id_prevision`** INT [PK], 
    `montant_estime` DECIMAL(15,2) NOT NULL, 
    `periode` VARCHAR(50) NOT NULL, 
    #`id_ligne_budget` INT [FK] NOT NULL
)

* **`ENGAGEMENT_BUDGET`** (
    **`id_engagement`** INT [PK], 
    `num_engagement_cf` VARCHAR(100) UNIQUE NOT NULL, 
    `montant_engage` DECIMAL(15,2) NOT NULL, 
    `date_visa_cf` DATE NOT NULL, 
    `statut_engagement` VARCHAR(30) NOT NULL, 
    #`id_ligne_budget` INT [FK] NOT NULL, 
    #`id_client` INT [FK] NOT NULL
)

---

## 🛒 Bloc 4 : Cycle Documentaire Commercial (Ventes & Workflows)

* **`PLANIFICATION_BESOIN`** (
    **`id_planification`** INT [PK], 
    `date_planif` DATE NOT NULL, 
    `periode_cible` VARCHAR(50) NOT NULL, 
    #`id_client` INT [FK] NOT NULL
)

* **`DEVIS_PROFORMA`** (
    **`id_devis`** INT [PK], 
    `num_devis` VARCHAR(50) UNIQUE NOT NULL, 
    `date_devis` DATE NOT NULL, 
    `validite_jours` INT DEFAULT 30, 
    #`id_client` INT [FK] NOT NULL
)

* **`COMMANDE`** (
    **`id_commande`** INT [PK], 
    `num_commande` VARCHAR(50) UNIQUE NOT NULL, 
    `date_commande` DATE NOT NULL, 
    `statut_commande` VARCHAR(30) NOT NULL, 
    #`id_client` INT [FK] NOT NULL, 
    #`id_devis` INT [FK] UNIQUE NULL, 
    #`id_engagement` INT [FK] UNIQUE NULL
)

* **`PREPARATION_COMMANDE`** (
    **`id_preparation`** INT [PK], 
    `date_prepa` TIMESTAMP NOT NULL, 
    `statut_prepa` VARCHAR(30) NOT NULL, 
    #`id_commande` INT [FK] UNIQUE NOT NULL
)

* **`BON_LIVRAISON`** (
    **`id_livraison`** INT [PK], 
    `num_bl` VARCHAR(50) UNIQUE NOT NULL, 
    `date_livraison` TIMESTAMP NOT NULL, 
    #`id_preparation` INT [FK] UNIQUE NULL, 
    #`id_facture` INT [FK] UNIQUE NULL
)

* **`FACTURE`** (
    **`id_facture`** INT [PK], 
    `num_facture` VARCHAR(50) UNIQUE NOT NULL, 
    `date_facture` TIMESTAMP NOT NULL, 
    `montant_ht` DECIMAL(15,2) NOT NULL, 
    `tva` DECIMAL(15,2) NOT NULL, 
    `type_facturation` VARCHAR(30) NOT NULL, *(CHECK: 'QUITTANCE', 'VIREMENT_TRESOR')*
    `statut_paiement` VARCHAR(30) NOT NULL, 
    #`id_commande` INT [FK] UNIQUE NULL, 
    #`id_client` INT [FK] NULL
    *(Contrainte XOR : (`id_commande` IS NOT NULL AND `id_client` IS NULL) OR (`id_commande` IS NULL AND `id_client` IS NOT NULL))*
)

* **`AVOIR`** (
    **`id_avoir`** INT [PK], 
    `num_avoir` VARCHAR(50) UNIQUE NOT NULL, 
    `date_avoir` TIMESTAMP NOT NULL, 
    `motif` TEXT NOT NULL, 
    #`id_facture` INT [FK] NOT NULL
)

---

## 📑 Bloc 4.1 : Tables de Liaison (Lignes de Documents)

* **`LIGNE_PLANIFICATION`** (
    **#`id_planification`** INT [FK], 
    **#`id_produit`** INT [FK], 
    `quantite_estimee` INT NOT NULL, 
    PRIMARY KEY (**`id_planification`**, **`id_produit`**)
)

* **`LIGNE_DEVIS`** (
    **#`id_devis`** INT [FK], 
    **#`id_produit`** INT [FK], 
    `quantite` INT NOT NULL, 
    `prix_unitaire_devis` DECIMAL(15,2) NOT NULL, 
    PRIMARY KEY (**`id_devis`**, **`id_produit`**)
)

* **`LIGNE_COMMANDE`** (
    **#`id_commande`** INT [FK], 
    **#`id_produit`** INT [FK], 
    `quantite_commandee` INT NOT NULL, 
    `prix_unitaire_facture` DECIMAL(15,2) NOT NULL, 
    PRIMARY KEY (**`id_commande`**, **`id_produit`**)
)

* **`LIGNE_PREPARATION`** (
    **#`id_preparation`** INT [FK], 
    **#`id_produit`** INT [FK], 
    `quantite_preparee` INT NOT NULL, 
    PRIMARY KEY (**`id_preparation`**, **`id_produit`**)
)

* **`LIGNE_LIVRAISON`** (
    **#`id_livraison`** INT [FK], 
    **#`id_produit`** INT [FK], 
    `quantite_livree` INT NOT NULL, 
    PRIMARY KEY (**`id_livraison`**, **`id_produit`**)
)

* **`LIGNE_FACTURE`** (
    **#`id_facture`** INT [FK], 
    **#`id_produit`** INT [FK], 
    `quantite_facturee` INT NOT NULL, 
    PRIMARY KEY (**`id_facture`**, **`id_produit`**)
)

* **`LIGNE_AVOIR`** (
    **#`id_avoir`** INT [FK], 
    **#`id_produit`** INT [FK], 
    `quantite_retournee` INT NOT NULL, 
    `montant_avoir` DECIMAL(15,2) NOT NULL, 
    PRIMARY KEY (**`id_avoir`**, **`id_produit`**)
)

---

## 📦 Bloc 5 : Catalogue Produits, Stock & Lancement en Série

* **`CATEGORIE_PRODUIT`** (
    **`id_categorie`** INT [PK], 
    `libelle_categorie` VARCHAR(100) NOT NULL
)

* **`CONFIG_SERIE_DOCUMENT`** (
    **`id_config`** INT [PK], 
    `dernier_numero_valide` INT NOT NULL, 
    `prefixe_courant` VARCHAR(10) NULL
)

* **`PRODUIT_FINI`** (
    **`id_produit`** INT [PK], 
    `code_produit` VARCHAR(50) UNIQUE NOT NULL, 
    `designation` VARCHAR(150) NOT NULL, 
    `prix_tarif` DECIMAL(15,2) NOT NULL, 
    #`id_categorie` INT [FK] NOT NULL, 
    #`id_config` INT [FK] UNIQUE NULL
)

* **`LOT_LANCEMENT_SERIE`** (
    **`id_lot`** INT [PK], 
    `num_lot` VARCHAR(50) UNIQUE NOT NULL, 
    `prefixe_serie` VARCHAR(10) NULL, 
    `num_debut` INT NOT NULL, 
    `num_fin` INT NOT NULL, 
    `quantite_lancee` INT NOT NULL, 
    `date_lancement` TIMESTAMP NOT NULL, 
    `statut_prod` VARCHAR(30) NOT NULL, 
    #`id_config` INT [FK] NOT NULL, 
    #`id_produit` INT [FK] NOT NULL, 
    #`id_preparation` INT [FK] NULL
)

* **`MAGASIN_DEPOT`** (
    **`id_magasin`** INT [PK], 
    `nom_magasin` VARCHAR(100) NOT NULL, 
    `code_depot` VARCHAR(20) UNIQUE NOT NULL
)

* **`EMPLACEMENT`** (
    **`id_emplacement`** INT [PK], 
    `code_allee` VARCHAR(10) NOT NULL, 
    `code_etagere` VARCHAR(10) NOT NULL, 
    #`id_magasin` INT [FK] NOT NULL
)

* **`LIGNE_STOCK`** (
    **#`id_emplacement`** INT [FK], 
    **#`id_produit`** INT [FK], 
    `quantite_physique` INT NOT NULL DEFAULT 0, 
    `quantite_reservee` INT NOT NULL DEFAULT 0, 
    PRIMARY KEY (**`id_emplacement`**, **`id_produit`**)
)

* **`RESERVATION_STOCK`** (
    **`id_reservation`** INT [PK], 
    `quantite_bloquee` INT NOT NULL, 
    `date_limite` TIMESTAMP NOT NULL, 
    #`id_preparation` INT [FK] NULL, 
    #`id_produit` INT [FK] NOT NULL
)

* **`MOUVEMENT_STOCK`** (
    **`id_mouvement`** INT [PK], 
    `type_mouvement` VARCHAR(30) NOT NULL, 
    `quantite_mouv` INT NOT NULL, 
    `date_mouv` TIMESTAMP NOT NULL, 
    #`id_produit` INT [FK] NOT NULL, 
    #`id_livraison` INT [FK] NULL
)

---

## 💳 Bloc 6 : Trésorerie, Matrice de Quittance & Règlement

* **`REGLEMENT`** (
    **`id_reglement`** INT [PK], 
    `mode_reglement` VARCHAR(30) NOT NULL, 
    `date_reglement` TIMESTAMP NOT NULL, 
    `montant_regle` DECIMAL(15,2) NOT NULL, 
    `num_virement_tresor` VARCHAR(100) NULL, 
    #`id_facture` INT [FK] NOT NULL
)

* **`LIVRE_QUITTANCE`** (
    **`id_livre`** INT [PK], 
    `numero_livre` VARCHAR(50) UNIQUE NOT NULL, 
    `annee_ouverture` INT NOT NULL, 
    `statut_livre` VARCHAR(30) NOT NULL
)

* **`QUITTANCE`** (
    **`id_quittance`** INT [PK], 
    `num_feuille` INT NOT NULL, *(CHECK: num_feuille BETWEEN 1 AND 50)*
    `attribut_volet` VARCHAR(1) NOT NULL, *(CHECK: attribut_volet IN ('A','B','C','D','E'))*
    `date_emission` TIMESTAMP NOT NULL, 
    #`id_livre` INT [FK] NOT NULL, 
    #`id_reglement` INT [FK] UNIQUE NULL, 
    #`id_caisse` INT [FK] NOT NULL, 
    CONSTRAINT `uk_quittance_matrice` UNIQUE (`id_livre`, `num_feuille`, `attribut_volet`)
)

* **`CAISSE`** (
    **`id_caisse`** INT [PK], 
    `code_caisse` VARCHAR(20) UNIQUE NOT NULL, 
    `libelle_caisse` VARCHAR(100) NOT NULL, 
    `solde_actuel` DECIMAL(15,2) NOT NULL DEFAULT 0.00
)

* **`LIVRE_CAISSE`** (
    **`id_livre_caisse`** INT [PK], 
    `date_operation` TIMESTAMP NOT NULL, 
    `type_operation` VARCHAR(30) NOT NULL, 
    `montant_op` DECIMAL(15,2) NOT NULL, 
    #`id_caisse` INT [FK] NOT NULL
)

* **`RECOUVREMENT`** (
    **`id_recouvrement`** INT [PK], 
    `num_dossier` VARCHAR(50) UNIQUE NOT NULL, 
    `date_relance` DATE NOT NULL, 
    `niveau_relance` INT NOT NULL, 
    `statut_dossier` VARCHAR(30) NOT NULL
)

* **`LIGNE_RECOUVREMENT`** (
    **#`id_recouvrement`** INT [FK], 
    **#`id_facture`** INT [FK], 
    `montant_a_recouvrer` DECIMAL(15,2) NOT NULL, 
    PRIMARY KEY (**`id_recouvrement`**, **`id_facture`**)
)

---

## 🔐 Bloc 7 : Sécurité, Rôles & Utilisateurs (RBAC)

* **`UTILISATEUR`** (
    **`id_utilisateur`** INT [PK], 
    `matricule` VARCHAR(50) UNIQUE NOT NULL, 
    `nom_complet` VARCHAR(150) NOT NULL, 
    `identifiant` VARCHAR(50) UNIQUE NOT NULL, 
    `mot_de_passe` VARCHAR(255) NOT NULL, 
    `statut_compte` VARCHAR(20) NOT NULL
)

* **`ROLE`** (
    **`id_role`** INT [PK], 
    `libelle_role` VARCHAR(50) UNIQUE NOT NULL
)

* **`PRIVILEGE`** (
    **`id_privilege`** INT [PK], 
    `code_action` VARCHAR(100) UNIQUE NOT NULL, 
    `description` TEXT NULL
)

* **`UTILISATEUR_ROLE`** (
    **#`id_utilisateur`** INT [FK], 
    **#`id_role`** INT [FK], 
    PRIMARY KEY (**`id_utilisateur`**, **`id_role`**)
)

* **`ROLE_PRIVILEGE`** (
    **#`id_role`** INT [FK], 
    **#`id_privilege`** INT [FK], 
    PRIMARY KEY (**`id_role`**, **`id_privilege`**)
)
