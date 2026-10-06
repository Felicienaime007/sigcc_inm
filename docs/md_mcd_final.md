# MODÈLE CONCEPTUEL DE DONNÉES (MCD) OPTIMISÉ - SIGCC (INM)
## SYSTÈME INTÉGRÉ DE GESTION DU CYCLE COMMERCIAL DE L'IMPRIMERIE NATIONALE DE MADAGASCAR

---

## 1. Dictionnaire des Entités et Propriétés

### 🌐 Bloc 1 : Administration & Découpage Territorial
*   **PROVINCE** (**id_province**, nom_province)
*   **REGION** (**id_region**, nom_region)
*   **DISTRICT** (**id_district**, nom_district)
*   **COMMUNE** (**id_commune**, nom_commune, type_commune) *(Type: Urbaine, Rurale)*
*   **FOKONTANY** (**id_fokontany**, nom_fokontany)
*   **ORGANISME** (**id_organisme**, nom_organisme, code_institutionnel) *(Ex: Ministère de l'Éducation Nationale, Région Analamanga)*

### 👥 Bloc 2 : Clients & Profils Commerciaux
*   **CLIENT** (**id_client**, code_soa, nom_client, type_client, adresse, telephone, cin_ou_nif)
    *   *Règle métier :* type_client prend les valeurs ('MINISTERE', 'CTD', 'PRIVE', 'SIMPLE'). Si SIMPLE, le client est enregistré au comptoir par la réception.
*   **SOLVABILITE_CLIENT** (**id_solvabilite**, score_credit, plafond_encours, statut_blocage)
    *   *Règle métier :* Concerne uniquement le type PRIVE pour évaluer les risques avant commande.

### 💰 Bloc 3 : Finances Publiques & Budgets
*   **TYPE_FINANCEMENT** (**id_type_financement**, libelle_financement)
*   **BUDGET** (**id_budget**, annee_budgetaire, montant_alloue)
*   **LIGNE_BUDGETAIRE** (**id_ligne_budget**, code_article, libelle_ligne, montant_disponible)
*   **PREVISION_BUDGETAIRE** (**id_prevision**, montant_estime, periode)
*   **ENGAGEMENT_BUDGET** (**id_engagement**, num_engagement_cf, montant_engage, date_visa_cf, statut_engagement)

### 🛒 Bloc 4 : Cycle Documentaire Commercial (Ventes & Workflows)
*   **PLANIFICATION_BESOIN** (**id_planification**, date_planif, periode_cible)
*   **DEVIS_PROFORMA** (**id_devis**, num_devis, date_devis, validite_jours)
*   **COMMANDE** (**id_commande**, num_commande, date_commande, statut_commande)
*   **PREPARATION_COMMANDE** (**id_preparation**, date_prepa, statut_prepa)
*   **BON_LIVRAISON** (**id_livraison**, num_bl, date_livraison)
*   **FACTURE** (**id_facture**, num_facture, date_facture, montant_ht, tva, type_facturation, statut_paiement)
    *   *Règle métier :* type_facturation prend la valeur ('QUITTANCE', 'VIREMENT_TRESOR').
*   **AVOIR** (**id_avoir**, num_avoir, date_avoir, motif)

### 📦 Bloc 5 : Catalogue Produits, Stock & Lancement en Série
*   **CATEGORIE_PRODUIT** (**id_categorie**, libelle_categorie)
*   **PRODUIT_FINI** (**id_produit**, code_produit, designation, prix_tarif)
*   **CONFIG_SERIE_DOCUMENT** (**id_config**, dernier_numero_valide, prefixe_courant)
*   **LOT_LANCEMENT_SERIE** (**id_lot**, num_lot, prefixe_serie, num_debut, num_fin, quantite_lancee, date_lancement, statut_prod)
*   **MAGASIN_DEPOT** (**id_magasin**, nom_magasin, code_depot)
*   **EMPLACEMENT** (**id_emplacement**, code_allee, code_etagere)
*   **RESERVATION_STOCK** (**id_reservation**, quantite_bloquee, date_limite)
*   **MOUVEMENT_STOCK** (**id_mouvement**, type_mouvement, quantite_mouv, date_mouv)

### 💳 Bloc 6 : Trésorerie, Matrice de Quittance & Règlement
*   **REGLEMENT** (**id_reglement**, mode_reglement, date_reglement, montant_regle, num_virement_tresor)
*   **LIVRE_QUITTANCE** (**id_livre**, numero_livre, annee_ouverture, statut_livre)
*   **QUITTANCE** (**id_quittance**, num_feuille, attribut_volet, date_emission)
*   **CAISSE** (**id_caisse**, code_caisse, libelle_caisse, solde_actuel)
*   **LIVRE_CAISSE** (**id_livre_caisse**, date_operation, type_operation, montant_op)
*   **RECOUVREMENT** (**id_recouvrement**, num_dossier, date_relance, niveau_relance, statut_dossier)

### 🔐 Bloc 7 : Sécurité, Rôles & Utilisateurs
*   **UTILISATEUR** (**id_utilisateur**, matricule, nom_complet, identifiant, mot_de_passe, statut_compte)
*   **ROLE** (**id_role**, libelle_role)
*   **PRIVILEGE** (**id_privilege**, code_action, description)

---

## 2. Associations et Cardinalités Normalisées

### Hiérarchie Territoriale
*   **PROVINCE (1,N) ── [Englober] ── (1,1) REGION**
*   **REGION (1,N) ── [Appartenir] ── (1,1) DISTRICT**
*   **DISTRICT (1,N) ── [Comprendre] ── (1,1) COMMUNE**
*   **COMMUNE (1,N) ── [Diviser] ── (1,1) FOKONTANY**
*   **FOKONTANY (0,N) ── [Localiser] ── (1,1) CLIENT**

### Rattachement Client & Structure
*   **ORGANISME (0,N) ── [Rattacher] ── (0,1) CLIENT**
*   **CLIENT (0,1) ── [Posséder] ── (1,1) SOLVABILITE_CLIENT** *(Règle : type_client = 'PRIVE')*

### Gestion Budgétaire de l'État
*   **ORGANISME (0,N) ── [Disposer] ── (1,1) BUDGET**
*   **BUDGET (1,N) ── [Contenir] ── (1,1) LIGNE_BUDGETAIRE**
*   **TYPE_FINANCEMENT (0,N) ── [Financer] ── (1,1) LIGNE_BUDGETAIRE**
*   **LIGNE_BUDGETAIRE (1,N) ── [Estimer] ── (1,1) PREVISION_BUDGETAIRE**
*   **LIGNE_BUDGETAIRE (0,N) ── [Allouer] ── (1,1) ENGAGEMENT_BUDGET**
*   **CLIENT (0,N) ── [Bénéficier] ── (1,1) ENGAGEMENT_BUDGET**

### Workflows Commerciaux & Vente Directe
*   **CLIENT (0,N) ── [Planifier] ── (1,1) PLANIFICATION_BESOIN**
*   **CLIENT (0,N) ── [Demander] ── (1,1) DEVIS_PROFORMA**
*   **DEVIS_PROFORMA (0,1) ── [Transformer] ── (1,1) COMMANDE**
*   **COMMANDE (0,1) ── [Associer] ── (0,1) ENGAGEMENT_BUDGET**
*   **CLIENT (0,N) ── [Passer] ── (1,1) COMMANDE**
*   **COMMANDE (0,1) ── [Préparer] ── (1,1) PREPARATION_COMMANDE**
*   **PREPARATION_COMMANDE (0,1) ── [Générer] ── (1,1) BON_LIVRAISON**
*   **COMMANDE (0,1) ── [Facturer] ── (1,1) FACTURE**
*   **CLIENT (0,N) ── [Facturer Directement] ── (0,1) FACTURE** *(Vente comptoir)*
*   **FACTURE (0,1) ── [Livrer Comptoir] ── (0,1) BON_LIVRAISON**
*   **FACTURE (0,N) ── [Rectifier] ── (1,1) AVOIR**

> **Contrainte d'Exclusion (XOR) - FACTURE :**  
> Une instance de `FACTURE` est liée à **soit** une `COMMANDE` (via *Facturer*), **soit** un `CLIENT` (via *Facturer Directement*), mais **jamais aux deux**.

### Associations Porteuses de Données (Lignes de documents)
*   **PLANIFICATION_BESOIN (1,N) ── [Ligne Planif] ── (0,N) PRODUIT_FINI** *(Attribut : quantite_estimee)*
*   **DEVIS_PROFORMA (1,N) ── [Ligne Devis] ── (0,N) PRODUIT_FINI** *(Attributs : quantite, prix_unitaire_devis)*
*   **COMMANDE (1,N) ── [Ligne Commande] ── (0,N) PRODUIT_FINI** *(Attributs : quantite_commandee, prix_unitaire_facture)*
*   **PREPARATION_COMMANDE (1,N) ── [Ligne Préparation] ── (0,N) PRODUIT_FINI** *(Attribut : quantite_preparee)*
*   **BON_LIVRAISON (1,N) ── [Ligne Livr] ── (0,N) PRODUIT_FINI** *(Attribut : quantite_livree)*
*   **FACTURE (1,N) ── [Ligne Facture] ── (0,N) PRODUIT_FINI** *(Attribut : quantite_facturee)*
*   **AVOIR (1,N) ── [Ligne Avoir] ── (0,N) PRODUIT_FINI** *(Attributs : quantite_retournee, montant_avoir)*

### Production & Stocks
*   **CATEGORIE_PRODUIT (1,N) ── [Classer] ── (1,1) PRODUIT_FINI**
*   **PRODUIT_FINI (0,1) ── [Configurer] ── (1,1) CONFIG_SERIE_DOCUMENT**
*   **CONFIG_SERIE_DOCUMENT (1,N) ── [Générer] ── (1,1) LOT_LANCEMENT_SERIE**
*   **PRODUIT_FINI (0,N) ── [Imprimer] ── (1,1) LOT_LANCEMENT_SERIE**
*   **PREPARATION_COMMANDE (0,1) ── [Planifier Prod] ── (0,N) LOT_LANCEMENT_SERIE**
*   **MAGASIN_DEPOT (1,N) ── [Stocker Dans] ── (1,1) EMPLACEMENT**
*   **EMPLACEMENT (1,N) ── [Détailler Stock] ── (1,N) PRODUIT_FINI** *(Association porteuse `LIGNE_STOCK` : quantite_physique, quantite_reservee)*
*   **PREPARATION_COMMANDE (0,N) ── [Réserver] ── (0,1) RESERVATION_STOCK**
*   **PRODUIT_FINI (1,N) ── [Affecter Stock] ── (1,1) RESERVATION_STOCK**
*   **PRODUIT_FINI (1,N) ── [Tracer] ── (1,1) MOUVEMENT_STOCK**
*   **BON_LIVRAISON (0,N) ── [Déclencher] ── (1,1) MOUVEMENT_STOCK**

### Trésorerie & Matrice SFC
*   **FACTURE (1,1) ── [Régler] ── (0,N) REGLEMENT**
*   **REGLEMENT (0,1) ── [Émettre] ── (0,1) QUITTANCE** *(Règle : mode_reglement = 'ESPECES' ou 'QUITTANCE')*
*   **LIVRE_QUITTANCE (1,N) ── [Contenir Volets] ── (1,1) QUITTANCE** *(Règle : Carnet de 250 volets)*
*   **QUITTANCE (0,1) ── [Déposer] ── (1,1) CAISSE**
*   **CAISSE (1,N) ── [Consigner] ── (1,1) LIVRE_CAISSE**
*   **FACTURE (0,N) ── [Suivre Impayé] ── (1,1) RECOUVREMENT** *(Association porteuse `LIGNE_RECOUVREMENT`)*

### Gestion des Droits d'Accès (RBAC)
*   **UTILISATEUR (0,N) ── [Attribuer_Role] ── (1,N) ROLE**
*   **ROLE (0,N) ── [Accorder_Privilege] ── (1,N) PRIVILEGE**
