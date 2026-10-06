# CHAPITRE V : ANALYSE CONCEPTUELLE ET SPÉCIFICATIONS DU SYSTÈME

## 5.1. Introduction

Ce chapitre est consacré à la formalisation conceptuelle du Système Intégré de Gestion du Cycle Commercial (SIGCC) pour l'Imprimerie Nationale de Madagascar (INM). Suivant une démarche d'ingénierie logicielle rigoureuse, nous posons les bases fonctionnelles et structurelles du système. Nous présentons d'abord la capture des exigences à travers le formalisme Scrum (Acteurs, Product Backlog, User Stories), avant de basculer sur la modélisation sémantique des données (Règles de gestion, Dictionnaire des données et formalisation du Modèle Conceptuel de Données).

---

## 5.2. Capture des Exigences et Spécifications Agiles

### 5.2.1. Cartographie Exhaustive des Acteurs du Système

| Acteur Métier | Description Fonctionnelle et Périmètre d'Action | Privilèges Systèmes Associés (code_action) |
|---|---|---|
| **Responsable Réception** | Gère le premier point de contact à l'accueil physique de l'INM. Il identifie les usagers passagers et initialise les dossiers de vente au comptoir. | CREER_CLIENT_SIMPLE, RECHERCHER_CLIENT, CONSULTER_COMMUNE |
| **Agent Commercial** | Enregistre les planifications de besoins, monte les dossiers de cotation, édite les factures et suit les workflows documentaires des clients professionnels. | CREER_CLIENT_CORPO, EMETTRE_PROFORMA, SAISIR_COMMANDE, GENERER_FACTURE, CONSULTER_STOCK |
| **Chef Service Ventes** | Supervise l'activité commerciale globale de l'établissement, valide les grilles tarifaires, orchestre les lancements d'impression et gère les avoirs. | VALIDER_PRIX_CATALOGUE, APPROUVER_LANCEMENT_SERIE, VALIDER_AVOIR, CONSULTER_AUDIT_TRAIL |
| **Caissier SFC** | Opère au guichet d'encaissement du Service Financier et Comptable (SFC) pour la perception immédiate des fonds des clients au comptoir. | ENCAISSER_FONDS, REMPLIR_QUITTANCE_MATRICE, OUVRIR_CAISSE, CONSULTER_LIVRE_CAISSE |
| **Comptable Public / SFC** | Assure le contrôle des deniers publics, valide la santé budgétaire des ministères (SOA), enregistre les virements du Trésor et pilote le recouvrement. | VALIDER_ENGAGEMENT_BUDGET, ENREGISTRER_VIREMENT_TRESOR, DECLENCHER_RECOUVREMENT, MODIFIER_PLAFOND_ENCOURS |
| **Gestionnaire de Stock** | Assure la tenue physique et informatique des hangars de stockage de l'INM, pilote les colisages et valide les bons de livraison. | CREER_PREPARATION, VALIDER_RESERVATION_STOCK, EMETTRE_BON_LIVRAISON, AJUSTER_EMPLACEMENT, CONSIGNER_MOUVEMENT |
| **Administrateur Système** | Supervise la plateforme applicative, configure l'infrastructure, crée les comptes des agents et audite les journaux de sécurité. | CREER_UTILISATEUR, AFFECTER_ROLE, CONFIGUR_PRIVILEGE, PURGER_RESERVATIONS_EXPIREES |

### 5.2.2. Découpage en Thèmes Fonctionnels (Épics)

- **TH-01 : Référentiel Administratif & Tiers :** Gestion de la hiérarchie territoriale de Madagascar et des profils clients (Public / Privé / Comptoir).
- **TH-02 : Contrôle des Finances Publiques :** Gestion des enveloppes budgétaires ministérielles et suivi des visas du Contrôle Financier.
- **TH-03 : Chaîne Documentaire des Ventes :** Automatisation du cycle de vie des pièces commerciales (Devis, Commandes, Factures, Avoirs).
- **TH-04 : Ordonnancement & Traçabilité Industrielle :** Sécurisation anti-collision des compteurs numériques de tirages de documents officiels sécurisés.
- **TH-05 : Logistique de Stockage :** Gestion physique des magasins par emplacements, réservations logiques et traçabilité des mouvements.
- **TH-06 : Gestion de la Trésorerie Public-Privé :** Réconciliation des comptes du Trésor et imputabilité en temps réel de la matrice de quittances SFC.
- **TH-07 : Recouvrement des Créances :** Pilotage des relances automatisées et suivi des factures corporatives en souffrance.

### 5.2.3. Product Backlog de l'Application

| ID | Thème | Titre de la fonctionnalité | Importance | Estimation (j/h) | Démonstration (Critères d'acceptation) |
|---|---|---|---|---|---|
| PB-01 | TH-01 | Cartographie de la hiérarchie territoriale | Haute | 2 | Permettre de filtrer dynamiquement une adresse de la Province jusqu'au Fokontany. |
| PB-02 | TH-01 | Gestion unifiée des fiches clients | Haute | 2 | Valider la structure des champs d'un tiers selon son type (ex: code SOA obligatoire pour l'État). |
| PB-03 | TH-02 | Enregistrement budgétaire des Organismes | Moyenne | 2 | Configurer l'enveloppe de crédit et les lignes d'imputation comptables d'un Ministère par année. |
| PB-04 | TH-02 | Validation des Visas de Contrôle Financier | Critique | 3 | Enregistrer un Engagement Budgétaire et vérifier qu'il est approuvé avant toute liaison commerciale. |
| PB-05 | TH-03 | Émission des Devis Proforma et Planifications | Basse | 2 | Générer un devis proforma chiffré basé sur les prix tarifs du catalogue de l'imprimerie. |
| PB-06 | TH-03 | Tunnel d'exécution Commande publique / privée | Haute | 4 | Exécuter la validation de commande appliquant le filtre budgétaire (État) ou l'en-cours (Privé). |
| PB-07 | TH-03 | Workflow accéléré "Vente Comptoir Directe" | Critique | 4 | Générer une facture directe et un BL immédiat pour un client SIMPLE, sans étape de commande. |
| PB-08 | TH-04 | Configuration et isolation des plages de séries | Haute | 4 | Rejeter la création d'un lot d'impression si les bornes (Début-Fin) croisent une série déjà consommée. |
| PB-09 | TH-05 | Gestion fine des stocks par emplacement | Haute | 3 | Associer les produits finis à une allée et étagère précise dans un magasin donné de l'INM. |
| PB-10 | TH-05 | Verrouillage par Réservation Logique | Haute | 3 | Bloquer des quantités physiques en étagère lors de la préparation pour mettre à jour le stock disponible. |
| PB-11 | TH-05 | Traçabilité de l'origine des mouvements | Haute | 2 | Obliger tout mouvement de stock sortant à être rattaché à l'identifiant d'un Bon de Livraison officiel. |
| PB-12 | TH-06 | Verrouillage matriciel anti-fraude SFC | Critique | 5 | Bloquer un encaissement si les coordonnées (Livre, Feuille 1-50, Volet A-E) de la quittance existent déjà. |
| PB-13 | TH-06 | Clôture de facturation par Virement Trésor | Haute | 2 | Solder une facture de type public en saisissant la référence unique de virement émise par le Trésorier. |
| PB-14 | TH-06 | Centralisation des livres comptables de caisse | Moyenne | 2 | Générer l'écriture automatique d'Entrée/Sortie dans le livre journal dès qu'une caisse ou quittance bouge. |
| PB-15 | TH-07 | Pilotage des paliers de recouvrement privé | Moyenne | 3 | Identifier les factures privées en retard et éditer les fiches de relance adaptées (Amiable, Contentieux). |
| PB-16 | TH-03 | Gestion des anomalies logistiques et avoirs | Moyenne | 3 | Annuler une facture erronée en émettant un avoir financier et en réintégrant les produits retournés. |

### 5.2.4. Récits Utilisateurs (User Stories Référentes)

- **US-01 (Flux Comptoir) :** En tant que Caissier SFC, je veux enregistrer un paiement direct pour un client simple afin de générer instantanément une facture quittancée et autoriser le retrait immédiat en magasin.
- **US-02 (Contrôle État) :** En tant que Comptable Public, je veux lier un numéro d'engagement budgétaire visé par le Contrôle Financier à une commande État afin de respecter la réglementation financière publique.
- **US-03 (Anti-erreur Série) :** En tant que Chef Service Ventes, je veux configurer des plages numériques avec préfixes pour un lot d'impression afin d'empêcher les doublons de numéros sur les certificats sécurisés.
- **US-04 (Logistique) :** En tant que Gestionnaire de Stock, je veux que le système réserve automatiquement les produits d'une préparation de commande dans leur emplacement afin d'éviter de promettre la même marchandise à deux clients.

---

## 5.3. Modèle Conceptuel de Données (MCD Merise)

### 5.3.1. Liste Intégrale des Règles de Gestion (RG)

#### 🌐 Bloc 1 & 2 : Tiers, Territoires & Risques (Secteur Privé)

**RG-01 (Intégrité Territoriale Descendante) :** L'insertion de n'importe quelle entité géographique est soumise au contrôle de sa table parente. Une COMMUNE ne peut pas être créée si son `id_district` n'existe pas. Un CLIENT doit obligatoirement posséder une adresse rattachée à un `id_fokontany` valide.

**RG-02 (Contrainte de Structure par Type de Client) :** Le système applique un filtre obligatoire sur l'entité CLIENT. Si le `type_client` est MINISTERE ou CTD, le champ `code_soa` (5 chiffres) est obligatoire et doit être unique. Si le `type_client` est PRIVE ou SIMPLE, le champ `code_soa` doit être obligatoirement NULL.

**RG-03 (Sécurisation des En-cours Privés) :** La validation d'une COMMANDE pour un client de type PRIVE est automatiquement bloquée par le back-end si la table SOLVABILITE_CLIENT associée indique un `statut_blocage` = 1 (Vrai), ou si le montant total TTC de la commande, cumulé à l'en-cours actuel des factures non payées du client, dépasse son `plafond_encours` autorisé.

#### 💰 Bloc 3 : Finances Publiques & Budgets (Secteur État)

**RG-04 (Étanchéité des Crédits Publics) :** Le montant cumulé des attributs `montant_disponible` de toutes les LIGNE_BUDGETAIRE associées à un BUDGET ne peut jamais dépasser le `montant_alloue` initial de l'organisme pour l'année budgétaire en cours.

**RG-05 (Verrou de la Commande Publique d'État) :** Le passage d'une COMMANDE au statut `EN_PROD` pour un client public (Ministère/CTD) est interdit si le champ `id_engagement` est vide ou si l'entité ENGAGEMENT_BUDGET liée possède un `statut_engagement` différent de `'APPROUVE'`. De plus, le montant TTC de la commande doit être inférieur ou égal au `montant_engage` validé par le visa du Contrôle Financier.

**RG-06 (Consommation des Crédits après Visa) :** Dès qu'un ENGAGEMENT_BUDGET passe au statut `'APPROUVE'`, le système doit instantanément déduire son montant du champ `montant_disponible` de la LIGNE_BUDGETAIRE correspondante.

#### 🛒 Bloc 4 : Cycle Documentaire Commercial & Workflows

**RG-07 (Contrainte d'Exclusion Exclusive XOR de Facturation) :** Pour respecter l'historique des workflows, une instance de FACTURE doit obligatoirement respecter une contrainte d'exclusion stricte en base de données : soit elle est issue d'un processus long et liée à une commande (`id_commande IS NOT NULL AND id_client IS NULL`), soit elle est issue d'une vente comptoir directe et liée au client (`id_commande IS NULL AND id_client IS NOT NULL`). Les deux champs ne peuvent jamais être remplis ou être nuls en même temps.

**RG-08 (Algorithme de Déviation du Flux Comptoir - Client SIMPLE) :** Pour les clients de type SIMPLE, le système court-circuite le workflow standard. Il autorise la création d'une FACTURE directe sans devis ni commande amont. Le statut de cette facture passe automatiquement à `'PAYEE'` dès encaissement des fonds, ce qui génère de manière instantanée un BON_LIVRAISON rattaché à celle-ci.

**RG-09 (Calcul Mathématique Strict des Totaux) :** Le montant de l'attribut `montant_ht` d'une FACTURE ou d'un DEVIS_PROFORMA doit être calculé de manière automatisée par le système en faisant la somme stricte des multiplications `(quantite * prix_unitaire)` de ses lignes associées. Le champ `tva` doit être calculé en appliquant le taux légal en vigueur à Madagascar sur ce montant HT.

**RG-10 (Liaison Rationnelle des Avoirs) :** Un document d'AVOIR ne peut être généré que s'il est rattaché à une FACTURE initiale existante. Le montant cumulé des attributs `montant_avoir` de la table LIGNE_AVOIR ne peut jamais excéder le montant total TTC de la facture d'origine.

#### 📦 Bloc 5 : Catalogue Produits, Production & Logistique de Stock

**RG-11 (Algorithme d'Isolation des Séries Sécurisées) :** L'insertion ou la modification d'un enregistrement dans la table LOT_LANCEMENT_SERIE est bloquée si pour le même `id_produit` et le même `prefixe_serie`, la plage numérique définie par `[num_debut, num_fin]` intersecte les bornes d'un autre lot déjà validé. Le calcul de l'attribut `quantite_lancee` est automatisé selon la formule : `(num_fin - num_debut) + 1`.

**RG-12 (Plafonnement Logistique des Préparations) :** Lors de l'enregistrement d'une LIGNE_PREPARATION, la valeur de l'attribut `quantite_preparee` pour un produit donné doit être strictement supérieure à 0 et inférieure ou égale à la `quantite_commandee` figurant dans la LIGNE_COMMANDE d'origine.

**RG-13 (Sécurisation des Réservations Physiques) :** L'insertion d'une RESERVATION_STOCK incrémente automatiquement l'attribut `quantite_reservee` de la table LIGNE_STOCK correspondante (liaison par emplacement et produit). Le système doit vérifier que la quantité disponible, calculée par `(quantite_physique - quantite_reservee)`, est supérieure ou égale à la `quantite_bloquee` demandée.

**RG-14 (Protection des Écritures Logistiques) :** Toute décrémentation de la `quantite_physique` dans la table LIGNE_STOCK via l'insertion d'un MOUVEMENT_STOCK de type `'SORTIE_LIVR'` doit être obligatoirement justifiée par le raccordement de la clé étrangère de l'identifiant `id_livraison` d'un BON_LIVRAISON valide.

#### 💳 Bloc 6 : Trésorerie, Matrice de Quittance SFC & Recouvrement

**RG-15 (Contrôle d'Index de la Matrice SFC 50x5) :** L'enregistrement d'un encaissement dans la table QUITTANCE impose une contrainte stricte d'index unique composite sur les attributs `(id_livre, num_feuille, attribut_volet)`. Toute tentative de saisie d'un triplet existant lève une exception et annule l'opération. Le champ `num_feuille` doit être compris entre 1 et 50, et `attribut_volet` doit appartenir strictement à l'ensemble `['A', 'B', 'C', 'D', 'E']`.

**RG-16 (Alimentation Automatique du Livre de Caisse) :** Dès qu'un REGLEMENT est validé en base de données, le système doit exécuter une procédure générant instantanément une ligne dans la table LIVRE_CAISSE avec le type d'opération `'ENTREE'`, le montant correspondant, et mettre à jour le `solde_actuel` de l'entité CAISSE concernée.

**RG-17 (Condition de Règlement de l'État) :** L'enregistrement d'un REGLEMENT ayant pour `mode_reglement` = `'VIREMENT_TRESOR'` impose la saisie obligatoire d'une valeur unique et non nulle dans le champ `num_virement_tresor`.

#### 🔐 Bloc 7 : Administration & Sécurité (RBAC)

**RG-18 (Immutabilité de l'Audit Trail) :** Les opérations de traçabilité historique des données commerciales s'effectuent de manière isolée au niveau du SGBD. La couche applicative dispose uniquement d'un droit de lecture (SELECT) et ne dispose d'aucun privilège de modification (UPDATE) ou de suppression (DELETE) sur les tables d'audit.

---

### 5.3.2. Dictionnaire des Données Complet

| Nom | Description | Type | Taille | Commentaire / Contrainte |
|---|---|---|---|---|
| `id_province` | Identifiant technique de la province | NUMBER | INT | Clé primaire (CP) |
| `nom_province` | Nom officiel de la province | VARCHAR2 | 100 | Non Null |
| `id_region` | Identifiant technique de la région | NUMBER | INT | CP |
| `nom_region` | Nom officiel de la région malgache | VARCHAR2 | 100 | Unique, Non Null |
| `id_district` | Identifiant technique du district | NUMBER | INT | CP |
| `nom_district` | Nom du district de rattachement | VARCHAR2 | 100 | Non Null |
| `id_commune` | Identifiant technique de la commune | NUMBER | INT | CP |
| `nom_commune` | Nom de la commune | VARCHAR2 | 100 | Non Null |
| `type_commune` | Catégorie administrative | VARCHAR2 | 20 | CHECK : 'URBAINE', 'RURALE' |
| `id_fokontany` | Identifiant de la cellule territoriale de base | NUMBER | INT | CP |
| `nom_fokontany` | Nom du quartier ou groupement de villages | VARCHAR2 | 100 | Non Null |
| `id_organisme` | Identifiant de l'institution de tutelle | NUMBER | INT | CP |
| `nom_organisme` | Nom complet du Ministère ou de la CTD | VARCHAR2 | 255 | Non Null |
| `code_institutionnel` | Code de nomenclature budgétaire nationale | VARCHAR2 | 50 | Unique, Nullable |
| `id_client` | Identifiant unique du compte client / SOA | NUMBER | INT | CP |
| `code_soa` | Code Service Opérationnel Activité (État) | VARCHAR2 | 20 | Unique. Requis si Ministère ou CTD |
| `nom_client` | Raison sociale ou Nom complet du particulier | VARCHAR2 | 255 | Non Null |
| `type_client` | Profil d'intégration commerciale | VARCHAR2 | 20 | CHECK : 'MINISTERE', 'CTD', 'ORGANISME', 'PRIVE', 'SIMPLE' |
| `adresse` | Adresse géographique de facturation | VARCHAR2 | 255 | Nullable |
| `telephone` | Coordonnées de contact téléphonique | VARCHAR2 | 50 | Nullable |
| `cin_ou_nif` | Carte d'identité ou Identifiant fiscal | VARCHAR2 | 50 | Unique, Nullable |
| `id_solvabilite` | Identifiant technique du dossier de crédit | NUMBER | INT | CP (Uniquement si type_client = 'PRIVE') |
| `score_credit` | Note de confiance financière attribuée | NUMBER | INT | Valeur de contrôle interne |
| `plafond_encours` | En-cours de crédit financier maximal toléré | NUMBER | 15,2 | Valeur par défaut : 0.00 |
| `statut_blocage` | Indicateur binaire de gel du compte client | NUMBER | 1 | CHECK : 0 (Actif), 1 (Bloqué) |
| `id_type_financement` | Identifiant technique de la source financière | NUMBER | INT | CP |
| `libelle_financement` | Intitulé de la provenance des fonds publics | VARCHAR2 | 100 | Ex : 'Budget Général de l'État' |
| `id_budget` | Identifiant de l'enveloppe globale | NUMBER | INT | CP |
| `annee_budgetaire` | Exercice annuel d'imputation comptable | NUMBER | 4 | Non Null |
| `montant_alloue` | Crédit budgétaire global accordé | NUMBER | 15,2 | Non Null |
| `id_ligne_budget` | Identifiant technique de l'article budgétaire | NUMBER | INT | CP |
| `code_article` | Référence de la nomenclature ministérielle | VARCHAR2 | 50 | Non Null |
| `libelle_ligne` | Intitulé de la ligne budgétaire | VARCHAR2 | 255 | Non Null |
| `montant_disponible` | Solde disponible de la ligne budgétaire | NUMBER | 15,2 | Décrémenté lors des visas approuvés |
| `id_prevision` | Identifiant technique de la prévision | NUMBER | INT | CP |
| `montant_estime` | Évaluation financière du besoin périodique | NUMBER | 15,2 | Non Null |
| `periode` | Trimestre ou exercice visé | VARCHAR2 | 50 | Non Null |
| `id_engagement` | Identifiant unique de l'engagement | NUMBER | INT | CP |
| `num_engagement_cf` | Numéro de visa officiel du Contrôle Financier | VARCHAR2 | 100 | Unique. Requis pour valider une commande État |
| `montant_engage` | Enveloppe bloquée pour honorer la commande | NUMBER | 15,2 | Doit couvrir le montant TTC de la commande |
| `date_visa_cf` | Date de signature du Contrôle Financier | DATE | - | Non Null |
| `statut_engagement` | État logique du visa budgétaire | VARCHAR2 | 30 | CHECK : 'EN_ATTENTE', 'APPROUVE', 'REJETE' |
| `id_planification` | Identifiant unique de la planification | NUMBER | INT | CP |
| `date_planif` | Date d'enregistrement du besoin annuel | DATE | - | Non Null |
| `periode_cible` | Année ou campagne visée | VARCHAR2 | 50 | Non Null |
| `quantite_estimee` | Volume prévisionnel de pièces attendu | NUMBER | INT | Attribut de l'association LIGNE_PLANIFICATION |
| `id_devis` | Identifiant unique du devis proforma | NUMBER | INT | CP |
| `num_devis` | Numéro de pièce commerciale unique | VARCHAR2 | 50 | Unique, Non Null |
| `date_devis` | Date d'émission de la cotation | DATE | - | Non Null |
| `validite_jours` | Durée de garantie des tarifs | NUMBER | INT | Par défaut : 30 jours |
| `quantite` | Volume d'articles proposé | NUMBER | INT | Attribut de l'association LIGNE_DEVIS |
| `prix_unitaire_devis` | Tarif unitaire octroyé | NUMBER | 15,2 | Non Null |
| `id_commande` | Identifiant unique de la commande | NUMBER | INT | CP |
| `num_commande` | Référence unique de l'ordre de vente | VARCHAR2 | 50 | Unique, Non Null |
| `date_commande` | Date d'enregistrement de l'ordre | DATE | - | Non Null |
| `statut_commande` | État logique de traitement de l'ordre | VARCHAR2 | 30 | CHECK : 'EN_ATTENTE', 'EN_PROD', 'LIVREE', 'ANNULEE' |
| `quantite_commandee` | Volume d'unités contracté | NUMBER | INT | Attribut de l'association LIGNE_COMMANDE |
| `prix_unitaire_facture` | Prix de vente appliqué au contrat | NUMBER | 15,2 | Non Null |
| `id_preparation` | Identifiant de l'ordre de préparation | NUMBER | INT | CP. Passage logistique requis |
| `date_prepa` | Date d'ordonnancement de la préparation | DATE | - | Non Null |
| `statut_prepa` | État d'avancement du colisage atelier | VARCHAR2 | 30 | CHECK : 'A_PREPARER', 'PREPARE', 'EN_ATTENTE_STOCK' |
| `quantite_preparee` | Volume d'imprimés colisés en atelier | NUMBER | INT | Attribut de l'association LIGNE_PREPARATION |
| `id_livraison` | Identifiant unique du Bon de Livraison (BL) | NUMBER | INT | CP |
| `num_bl` | Référence de sortie de matériel légale | VARCHAR2 | 50 | Unique, Non Null |
| `date_livraison` | Date de remise matérielle | DATE | - | Non Null |
| `quantite_livree` | Volume physique remis au client | NUMBER | INT | Attribut de l'association LIGNE_LIVRAISON |
| `id_facture` | Identifiant unique de la facture | NUMBER | INT | CP |
| `num_facture` | Numéro de pièce comptable légal | VARCHAR2 | 50 | Unique, Non Null |
| `date_facture` | Date d'édition financière | DATE | - | Non Null |
| `montant_ht` | Valeur totale hors taxes cumulée | NUMBER | 15,2 | Non Null |
| `tva` | Montant de la taxe sur la valeur ajoutée | NUMBER | 15,2 | Non Null (Calcul automatique) |
| `type_facturation` | Canal financier d'imputation | VARCHAR2 | 30 | CHECK : 'QUITTANCE', 'VIREMENT_TRESOR' |
| `statut_paiement` | État du recouvrement de la facture | VARCHAR2 | 30 | CHECK : 'NON_PAYEE', 'PARTIEL', 'PAYEE' |
| `quantite_facturee` | Volume soumis à la facturation finale | NUMBER | INT | Attribut de l'association LIGNE_FACTURE |
| `id_avoir` | Identifiant unique de l'avoir | NUMBER | INT | CP |
| `num_avoir` | Numéro séquentiel de l'avoir | VARCHAR2 | 50 | Unique, Non Null |
| `date_avoir` | Date d'établissement de la correction | DATE | - | Non Null |
| `motif` | Justification de l'anomalie logistique | VARCHAR2 | 500 | Non Null |
| `quantite_retournee` | Volume réintégré au stock dépôt | NUMBER | INT | Attribut de l'association LIGNE_AVOIR |
| `montant_avoir` | Valeur financière créditée | NUMBER | 15,2 | Attribut de l'association LIGNE_AVOIR |
| `id_categorie` | Identifiant de la famille de produit | NUMBER | INT | CP |
| `libelle_categorie` | Désignation de la famille de catalogue | VARCHAR2 | 100 | Ex : 'Imprimés Sécurisés' |
| `id_produit` | Identifiant unique du produit fini | NUMBER | INT | CP |
| `code_produit` | Référence catalogue usine | VARCHAR2 | 50 | Unique, Non Null |
| `designation` | Désignation commerciale complète | VARCHAR2 | 255 | Non Null |
| `prix_tarif` | Prix de base officiel au catalogue | NUMBER | 15,2 | Non Null |
| `id_config` | Identifiant de configuration de série | NUMBER | INT | CP |
| `dernier_numero_valide` | Index numérique du dernier document émis | NUMBER | INT | Non Null. Sécurisation anti-fraude |
| `prefixe_courant` | Code alphabétique actif de la série | VARCHAR2 | 10 | Nullable. Ex : 'A' |
| `id_lot` | Identifiant unique du lot d'impression | NUMBER | INT | CP |
| `num_lot` | Référence de suivi de la presse/atelier | VARCHAR2 | 50 | Unique, Non Null |
| `prefixe_serie` | Code de série affecté au lot | VARCHAR2 | 10 | Nullable |
| `num_debut` | Borne numérique basse de début de tirage | NUMBER | INT | Non Null |
| `num_fin` | Borne numérique haute de fin de tirage | NUMBER | INT | Non Null |
| `quantite_lancee` | Volume produit calculé du lot | NUMBER | INT | Non Null. Formule : (num_fin - num_debut) + 1 |
| `date_lancement` | Date de mise sous presse | DATE | - | Non Null |
| `statut_prod` | État du processus industriel | VARCHAR2 | 30 | Non Null |
| `id_magasin` | Identifiant technique du hangar dépôt | NUMBER | INT | CP |
| `nom_magasin` | Nom du bâtiment logistique de l'INM | VARCHAR2 | 100 | Non Null |
| `code_depot` | Code court logistique | VARCHAR2 | 50 | Unique, Non Null |
| `id_emplacement` | Identifiant technique de l'emplacement | NUMBER | INT | CP |
| `code_allee` | Identifiant de la rangée de stockage | VARCHAR2 | 50 | Non Null |
| `code_etagere` | Référence du niveau de rayonnage | VARCHAR2 | 50 | Non Null |
| `quantite_physique` | Quantité comptée physiquement en étagère | NUMBER | INT | Attribut de l'association LIGNE_STOCK |
| `quantite_reservee` | Quantité virtuelle bloquée pour commandes | NUMBER | INT | Attribut de l'association LIGNE_STOCK |
| `id_reservation` | Identifiant du blocage logique de stock | NUMBER | INT | CP |
| `quantite_bloquee` | Volume de stock verrouillé temporairement | NUMBER | INT | Non Null |
| `date_limite` | Date d'expiration de la réservation | DATE | - | Non Null |
| `id_mouvement` | Identifiant unique du mouvement logistique | NUMBER | INT | CP |
| `type_mouvement` | Nature du flux de stock exécuté | VARCHAR2 | 30 | CHECK : 'ENTREE_PROD', 'SORTIE_LIVR', 'RETOUR_AVOIR' |
| `quantite_mouv` | Quantité incrémentée ou décrémentée | NUMBER | INT | Non Null |
| `date_mouv` | Horodatage précis du mouvement | TIMESTAMP | - | Non Null |
| `id_caisse` | Identifiant de la caisse d'encaissement | NUMBER | INT | CP |
| `code_caisse` | Référence de la caisse centrale ou annexe | VARCHAR2 | 50 | Unique, Non Null |
| `libelle_caisse` | Intitulé de l'emplacement de caisse | VARCHAR2 | 100 | Non Null |
| `solde_actuel` | Encours financier disponible | NUMBER | 15,2 | Non Null |
| `id_livre_caisse` | Identifiant technique du journal de caisse | NUMBER | INT | CP |
| `date_operation` | Date et heure de l'écriture en journal | TIMESTAMP | - | Non Null |
| `type_operation` | Sens du flux financier | VARCHAR2 | 20 | CHECK : 'ENTREE', 'SORTIE' |
| `montant_op` | Valeur comptabilisée au journal | NUMBER | 15,2 | Non Null |
| `id_reglement` | Identifiant unique du paiement commercial | NUMBER | INT | CP |
| `mode_reglement` | Instrument de paiement mobilisé | VARCHAR2 | 30 | CHECK : 'ESPECES', 'CHEQUE', 'VIREMENT_TRESOR' |
| `date_reglement` | Date d'exécution du paiement | DATE | - | Non Null |
| `montant_regle` | Somme financière effectivement perçue | NUMBER | 15,2 | Non Null |
| `num_virement_tresor` | Identifiant de la transaction publique | VARCHAR2 | 100 | Unique. Obligatoire si virement Trésor |
| `id_livre` | Identifiant unique du carnet SFC papier | NUMBER | INT | CP |
| `numero_livre` | Référence séquentielle imprimée sur le carnet | NUMBER | INT | Unique, Non Null |
| `annee_ouverture` | Année d'ouverture du carnet de souches | NUMBER | 4 | Non Null |
| `statut_livre` | Disponibilité du carnet de reçus | VARCHAR2 | 20 | CHECK : 'EN_COURS', 'EPUISE' |
| `id_quittance` | Identifiant unique du reçu de quittance | NUMBER | INT | CP |
| `num_feuille` | Numéro du feuillet dans le carnet SFC | NUMBER | 2 | Non Null. CHECK : Entre 1 et 50 |
| `attribut_volet` | Lettre du volet de la matrice (5 volets/p) | CHAR | 1 | Non Null. CHECK : 'A', 'B', 'C', 'D', 'E' |
| `date_emission` | Horodatage d'édition de la quittance | TIMESTAMP | - | Non Null |
| `id_recouvrement` | Identifiant unique du dossier de litige | NUMBER | INT | CP |
| `num_dossier` | Référence unique du dossier de contentieux | VARCHAR2 | 50 | Unique, Non Null |
| `date_relance` | Date de la dernière relance de paiement | DATE | - | Non Null |
| `niveau_relance` | Gradation de l'action de relance | NUMBER | INT | Gradation : 1 (Amiable) à 3 (Contentieux) |
| `statut_dossier` | État du recouvrement amiable ou forcé | VARCHAR2 | 30 | CHECK : 'EN_COURS', 'REGLE', 'CONTENTIEUX' |
| `montant_a_recouvrer` | Solde restant dû sur la facture litigieuse | NUMBER | 15,2 | Attribut de l'association LIGNE_RECOUVREMENT |
| `id_utilisateur` | Identifiant technique du compte agent | NUMBER | INT | CP |
| `matricule` | Matricule professionnel de l'agent INM | VARCHAR2 | 50 | Unique, Non Null |
| `nom_complet` | Nom et prénoms de l'utilisateur | VARCHAR2 | 150 | Non Null |
| `identifiant` | Login d'accès à l'application web | VARCHAR2 | 50 | Unique, Non Null |
| `mot_de_passe` | Empreinte cryptographique (Stockage hashé) | VARCHAR2 | 255 | Non Null |
| `statut_compte` | Indicateur d'autorisation d'accès | NUMBER | 1 | CHECK : 0 (Désactivé), 1 (Actif) |
| `id_role` | Identifiant technique du rôle fonctionnel | NUMBER | INT | CP |
| `libelle_role` | Titre du rôle applicatif | VARCHAR2 | 100 | Unique, Non Null |
| `id_privilege` | Identifiant technique de la permission | NUMBER | INT | CP |
| `code_action` | Clé technique de la permission | VARCHAR2 | 100 | Unique, Non Null |
| `description` | Description de l'action autorisée | VARCHAR2 | 255 | Nullable |

---

### 5.3.3. Formalisation des Entités, Associations et Cardinalités

Voici l'ensemble des relations logiques Merise formalisées pour l'infrastructure logicielle :

#### 🌐 Hiérarchie Territoriale

- **PROVINCE (1,N) ── [Englober] ── (1,1) REGION :** Une province regroupe plusieurs régions, une région appartient à une unique province historique.
- **REGION (1,N) ── [Appartenir] ── (1,1) DISTRICT :** Un district est rattaché à une seule région, une région contient plusieurs districts.
- **DISTRICT (1,N) ── [Comprendre] ── (1,1) COMMUNE :** Une commune s'inscrit dans les limites d'un unique district.
- **COMMUNE (1,N) ── [Diviser] ── (1,1) FOKONTANY :** La commune gère plusieurs fokontany de base.
- **FOKONTANY (0,N) ── [Localiser] ── (1,1) CLIENT :** Chaque client est géographiquement localisé dans un fokontany pour sa facturation.

#### 👥 Rattachement Client & Structure

- **ORGANISME (0,N) ── [Rattacher] ── (0,1) CLIENT :** Un client d'État (SOA) est adossé à un organisme public parent (Ministère/CTD centrale). Ce lien est nul pour un client du secteur privé ou passager.
- **CLIENT (0,1) ── [Posséder] ── (1,1) SOLVABILITE_CLIENT :** Un client de type corporatif PRIVE dispose d'une unique fiche de suivi des risques et d'en-cours financiers.

#### 💰 Gestion Budgétaire de l'État (B2G)

- **ORGANISME (0,N) ── [Disposer] ── (1,1) BUDGET :** Un budget annuel est alloué à un organisme public de l'État.
- **BUDGET (1,N) ── [Contenir] ── (1,1) LIGNE_BUDGETAIRE :** L'enveloppe budgétaire est fractionnée en lignes d'imputations comptables spécifiques.
- **TYPE_FINANCEMENT (0,N) ── [Financer] ── (1,1) LIGNE_BUDGETAIRE :** Une ligne budgétaire est adossée à un type de ressource financière étatique.
- **LIGNE_BUDGETAIRE (1,N) ── [Estimer] ── (1,1) PREVISION_BUDGETAIRE :** Une ligne fait l'objet d'estimations prévisionnelles d'utilisation.
- **LIGNE_BUDGETAIRE (0,N) ── [Allouer] ── (1,1) ENGAGEMENT_BUDGET :** Les engagements visés par le Contrôle Financier consomment les crédits d'une ligne.
- **CLIENT (0,N) ── [Bénéficier] ── (1,1) ENGAGEMENT_BUDGET :** L'engagement de crédit est émis au bénéfice d'un client (SOA) demandeur.

#### 🛒 Workflows Commerciaux (Relations Flexibles & Circuit Comptoir Dévié)

- **CLIENT (0,N) ── [Planifier] ── (1,1) PLANIFICATION_BESOIN :** Un client régulier peut soumettre ses expressions de besoins annuels.
- **CLIENT (0,N) ── [Demander] ── (1,1) DEVIS_PROFORMA :** Un client demande une cotation via l'émission d'un proforma.
- **DEVIS_PROFORMA (0,1) ── [Transformer] ── (1,1) COMMANDE :** Un devis proforma peut être converti en commande ferme (la commande peut aussi être créée à la volée).
- **COMMANDE (0,1) ── [Associer] ── (0,1) ENGAGEMENT_BUDGET :** Une commande publique est obligatoirement adossée à son visa d'engagement financier approuvé.
- **CLIENT (0,N) ── [Passer] ── (1,1) COMMANDE :** Une commande corporative est passée par un unique client (flux public ou privé).
- **COMMANDE (0,1) ── [Préparer] ── (1,1) PREPARATION_COMMANDE :** Une commande validée engendre un ordre de colisage et de préparation en atelier.
- **PREPARATION_COMMANDE (0,1) ── [Générer] ── (1,1) BON_LIVRAISON :** L'ordre de préparation aboutit à l'édition du Bon de Livraison (BL) lors de l'expédition.
- **COMMANDE (0,1) ── [Facturer] ── (1,1) FACTURE :** Une facture commerciale liquide financièrement une commande d'un client privé ou d'un SOA.
- **CLIENT (0,N) ── [Facturer Directement] ── (0,1) FACTURE :** *(Flux Vente Directe Comptoir)* Un client SIMPLE fait l'objet d'une facturation directe en guichet, sans passer par les étapes devis ni commande.
- **FACTURE (0,1) ── [Livrer Comptoir] ── (0,1) BON_LIVRAISON :** *(Flux Vente Directe Comptoir)* La validation du paiement d'une facture comptoir directe déclenche directement l'édition du Bon de Livraison pour remise immédiate.
- **FACTURE (0,N) ── [Rectifier] ── (1,1) AVOIR :** Une facture erronée ou faisant l'objet d'une anomalie est rectifiée par une fiche d'avoir.

#### 📑 Associations Porteuses de Données (Lignes de documents)

- **PLANIFICATION_BESOIN (1,N) ── [Ligne Planif] ── (0,N) PRODUIT_FINI :** Associe les besoins aux produits. Attribut : `quantite_estimee`.
- **DEVIS_PROFORMA (1,N) ── [Ligne Devis] ── (0,N) PRODUIT_FINI :** Détaille l'offre tarifaire. Attributs : `quantite`, `prix_unitaire_devis`.
- **COMMANDE (1,N) ── [Ligne Commande] ── (0,N) PRODUIT_FINI :** Contrat de vente unitaire. Attributs : `quantite_commandee`, `prix_unitaire_facture`.
- **PREPARATION_COMMANDE (1,N) ── [Ligne Préparation] ── (0,N) PRODUIT_FINI :** Structure le colisage en atelier. Attribut : `quantite_preparee`.
- **BON_LIVRAISON (1,N) ── [Ligne Livr] ── (0,N) PRODUIT_FINI :** Constate la livraison effective. Attribut : `quantite_livree`.
- **FACTURE (1,N) ── [Ligne Facture] ── (0,N) PRODUIT_FINI :** Liquidation financière unitaire. Attribut : `quantite_facturee`.
- **AVOIR (1,N) ── [Ligne Avoir] ── (0,N) PRODUIT_FINI :** Détaille les corrections appliquées. Attributs : `quantite_retournee`, `montant_avoir`.

#### 🖨️ Production, Traçabilité & Logistique de Stock

- **CATEGORIE_PRODUIT (1,N) ── [Classer] ── (1,1) PRODUIT_FINI :** Un produit appartient à une famille du catalogue de l'imprimerie.
- **PRODUIT_FINI (0,1) ── [Configurer] ── (1,1) CONFIG_SERIE_DOCUMENT :** Un produit de nature sécurisée est adossé à un compteur et à une configuration de série active.
- **CONFIG_SERIE_DOCUMENT (1,N) ── [Générer] ── (1,1) LOT_LANCEMENT_SERIE :** La configuration de la série ordonnance la création des lots de fabrication successifs.
- **PRODUIT_FINI (0,N) ── [Imprimer] ── (1,1) LOT_LANCEMENT_SERIE :** Un lot d'impression matérialise le tirage en volume d'un produit spécifique.
- **PREPARATION_COMMANDE (0,1) ── [Planifier Prod] ── (0,N) LOT_LANCEMENT_SERIE :** Un ordre de préparation peut déclencher la planification d'un tirage en atelier s'il s'agit d'une commande sur-mesure.
- **MAGASIN_DEPOT (1,N) ── [Stocker Dans] ── (1,1) EMPLACEMENT :** Un hangar de stockage de l'INM est découpé en emplacements physiques précis (allées/étagères).
- **EMPLACEMENT (1,N) ── [Détailler Stock] ── (1,N) PRODUIT_FINI :** Un emplacement contient des produits. Cette relation donne l'association porteuse LIGNE_STOCK (Attributs : `quantite_physique`, `quantite_reservee`).
- **PREPARATION_COMMANDE (0,N) ── [Réserver] ── (0,1) RESERVATION_STOCK :** L'ordre de préparation engendre une réservation de sécurité de marchandises.
- **PRODUIT_FINI (1,N) ── [Affecter Stock] ── (1,1) RESERVATION_STOCK :** La réservation bloque un produit fini donné.
- **PRODUIT_FINI (1,N) ── [Tracer] ── (1,1) MOUVEMENT_STOCK :** Chaque entrée ou sortie physique d'un produit engendre une écriture de mouvement historique.
- **BON_LIVRAISON (0,N) ── [Déclencher] ── (1,1) MOUVEMENT_STOCK :** Le mouvement sortant de stock est juridiquement et comptablement déclenché par un Bon de Livraison.

#### 💳 Trésorerie, Matrice SFC & Recouvrement

- **FACTURE (1,1) ── [Régler] ── (0,N) REGLEMENT :** Une facture fait l'objet d'un ou plusieurs règlements comptables (paiements partiels autorisés).
- **REGLEMENT (0,1) ── [Émettre] ── (0,1) QUITTANCE :** Un paiement effectué en numéraire ou chèque au comptoir donne lieu à l'émission d'une quittance souche.
- **LIVRE_QUITTANCE (1,N) ── [Contenir Volets] ── (1,1) QUITTANCE :** Un carnet physique de quittances du SFC contient ses feuillets et volets d'émissions unitaires.
- **QUITTANCE (0,1) ── [Déposer] ── (1,1) CAISSE :** Les fonds de la quittance alimentent directement une caisse physique de l'INM.
- **CAISSE (1,N) ── [Consigner] ── (1,1) LIVRE_CAISSE :** Les flux financiers de la caisse sont historisés ligne par ligne dans le livre journal de caisse.
- **FACTURE (0,N) ── [Suivre Impayé] ── (1,1) RECOUVREMENT :** Une facture d'un client privé restée impayée à échéance bascule dans un dossier de litige. Cette relation donne l'association porteuse LIGNE_RECOUVREMENT (Attribut : `montant_a_recouvrer`).
- **RECOUVREMENT (1,N) ── [Détailler Relance] ── (1,1) LIGNE_RECOUVREMENT :** Le dossier de litige suit et détaille les relances appliquées à la facture.

#### 🔐 Gestion des Droits d'Accès de Sécurité (RBAC)

- **UTILISATEUR (0,N) ── [UTILISATEUR_ROLE] ── (1,N) ROLE :** Un agent de l'INM se voit attribuer un ou plusieurs rôles applicatifs.
- **ROLE (0,N) ── [ROLE_PRIVILEGE] ── (1,N) PRIVILEGE :** Un rôle fonctionnel détient une liste de permissions d'actions (privilèges granulaires).

---

## 5.4. Conclusion

L'élaboration de cette Analyse Conceptuelle complète pose un cadre d'ingénierie logicielle robuste et imperméable aux failles pour le futur système commercial de l'Imprimerie Nationale de Madagascar. En structurant avec précision les profils de droits d'accès (RBAC), un Product Backlog exhaustif sans aucune omission, et les 18 Règles de Gestion systémiques, nous verrouillons l'intégrité de la plateforme. La formalisation sémantique des entités et des cardinalités Merise résout définitivement les problématiques d'interfaçage entre la comptabilité publique et les ventes de comptoir. Ce livrable théorique valide l'intégralité du domaine métier et ouvre la voie à son implémentation physique.
