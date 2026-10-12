# 📘 CAHIER DES CHARGES FONCTIONNEL & TECHNIQUE (CDCF)

# PROJET : CONCEPTION ET RÉALISATION DU SYSTÈME INTÉGRÉ DE GESTION DU CYCLE COMMERCIAL (SIGCC)

**Établissement cible :** Imprimerie Nationale de Madagascar (INM)  
**Architecture Cible :** Next.js (Front-End) + Django REST Framework (Back-End) + Oracle Database (Base de Données)

---

## 1. Présentation du projet

### 1.1 Intitulé du projet

**Conception et réalisation d’un Système Intégré de Gestion du Cycle Commercial (SIGCC) adapté aux parcours clients publics, corporatifs et de comptoir au sein de l’Imprimerie Nationale de Madagascar.**

### 1.2 Contexte

L’**Imprimerie Nationale de Madagascar (INM)** occupe une place stratégique unique au sein de la République de Madagascar. Elle est l'autorité centrale chargée de la production des documents officiels, hautement sécurisés et régaliens de l’État (Journaux Officiels, passeports, certificats administratifs, registres d'état civil, imprimés sécurisés).

Pour ce faire, l'INM opère à l'intersection de deux mondes financiers :

1. **La Comptabilité Publique (B2G) :** Traitement des Ministères, des Collectivités Territoriales Décentralisées (CTD : Régions, Communes) et des Organismes Publics. Ces entités se structurent autour de **Services Opérationnels Activités (SOA)** et leurs achats sont régis par le Budget Général de l'État via le visa obligatoire du Contrôle Financier.
2. **Le Secteur Commercial Libre (B2B / B2C) :** Vente de prestations et d'imprimés à des entreprises du secteur privé ou à de simples citoyens (clients passagers au comptoir) payant directement en caisse.

### 1.3 Problématique

Le système actuel d'information commerciale de l'INM repose sur des processus manuels ou semi-automatisés cloisonnés, ce qui engendre des dysfonctionnements majeurs :

- **Rupture des workflows documentaires :** Difficulté à faire cohabiter dans une même interface le parcours lourd de l'État (sur engagement budgétaire et paiement après service fait) avec le parcours instantané du comptoir (paiement à la commande).
- **Risques critiques de fraude et doublons :** Le suivi des plages numériques et des préfixes de séries des documents sécurisés (certificats, titres administratifs) est géré manuellement sur des registres papier, augmentant les risques de collisions de numéros.
- **Failles de réconciliation en trésorerie :** Le Service Financier et Comptable (SFC) utilise des carnets physiques de quittances (matrice de 50 feuillets à 5 volets) qui ne sont pas vérifiés en temps réel lors de la saisie informatique, ce qui complique le suivi des caisses et la réconciliation des virements directs du Trésor Public.

### 1.4 Objectif général

Concevoir et réaliser une plateforme logicielle web intégrée, robuste et sécurisée, capable d'unifier, d'automatiser et de piloter l'intégralité du cycle commercial de l'INM tout en garantissant une traçabilité financière et logistique absolue.

### 1.5 Objectifs spécifiques

- **Unifier les flux de vente :** Modéliser et gérer de bout en bout le flux Vente Comptoir (SIMPLE), le flux Public (MINISTERE/CTD) et le flux Privé (PRIVE).
- **Sécuriser la matrice SFC :** Verrouiller informatiquement l'attribution des quittances physiques basées sur le format des carnets nationaux (50 feuilles × 5 volets A, B, C, D, E) pour interdire toute double utilisation.
- **Zéro erreur de série :** Automatiser les compteurs de tirages et de numérotations pour les impressions sécurisées d'après l'état des configurations courantes.
- **Assurer la conformité budgétaire :** Bloquer dynamiquement les commandes étatiques n'ayant pas de visa d'engagement financier validé et vérifier les en-cours des entreprises privées.

---

## 2. Périmètre du projet

### 2.1 Fonctionnalités incluses

Le SIGCC englobe les modules fonctionnels suivants :

- **Module Tiers & Territoire :** Gestion de la hiérarchie administrative de Madagascar (Provinces, Régions, Districts, Communes, Fokontany) et des fiches clients détaillées (SOA, codes institutionnels, CIN/NIF).
- **Module Budget Public :** Enregistrement des enveloppes de crédit, suivi des lignes budgétaires par article, saisie et blocage sur les visas d'Engagements Budgétaires du Contrôle Financier.
- **Module Workflow Commercial :** Édition des planifications de besoins, des devis proforma, conversion en commandes, ordres de préparation d'atelier, génération des bons de livraison et édition des factures/avoirs.
- **Module Gestion des Stocks :** Cartographie des magasins et des étagères/allées (emplacements), gestion des lignes de stocks réels, gestion des réservations logiques de produits lors des commandes et traçabilité des origines des mouvements (entrées production/sorties livraisons).
- **Module Trésorerie :** Gestion des journaux et des soldes des caisses, enregistrement des virements Trésor compte à compte et saisie matricielle des quittances souches.
- **Module Contentieux & Recouvrement :** Suivi des factures privées non payées et édition automatique des relances par paliers.
- **Module Sécurité & Droits :** Authentification renforcée et contrôle d'accès basé sur les rôles et privilèges (RBAC), couplé à une journalisation immuable des actions sensibles (Audit Trail).

### 2.2 Fonctionnalités exclues

Sont explicitement exclus du périmètre de cette application :

- La gestion de la paie et des ressources humaines du personnel de l'INM.
- Le module d'achat de matières premières (fournisseurs de papier, encres, plaques).
- La maintenance industrielle des machines d'impression (GMAO).

---

## 3. Utilisateurs du système

Le système applique un cloisonnement strict des privilèges d'accès via les profils utilisateurs suivants :

| **RôleDescription** | |
| --- | --- |
| **Responsable Réception** | Enregistre l'identité des clients physiques (SIMPLE/passagers) à l'accueil de l'INM et digitalise leurs données de base. |
| **Agent Commercial** | Crée les fiches clients corporatifs, saisit les devis proforma, enregistre les commandes et prépare les bons de livraison. |
| **Chef Service Ventes** | Valide les lancements de production de séries, configure les grilles de prix au catalogue et approuve les avoirs. |
| **Caissier SFC** | Encaisse les fonds physiques au comptoir de vente directe et enregistre la quittance souche sur le carnet physique (Livre/Feuille/Volet). |
| **Comptable Public / SFC** | Enregistre et valide les avis de virements du Trésor Public (compte à compte), suit les engagements des SOA et gère le recouvrement. |
| **Gestionnaire de Stock** | Administre la logistique des magasins, prépare les colisages (lignes de préparation), valide les réservations et confirme la sortie physique par BL. |
| **Administrateur Système** | Gère le cycle de vie des comptes utilisateurs, attribue les rôles de sécurité et audite les fichiers logs de traçabilité. |

---

## 4. Description des fonctionnalités & Scénarios métiers

Le SIGCC doit exécuter dynamiquement trois scénarios métiers différenciés :

### 4.1 Scénario 1 : Flux "Vente Directe Comptoir" (Client SIMPLE)

Destiné aux particuliers venant acheter des documents au comptoir (ex: certificats, formulaires officiels).

1. Le *Responsable Réception* saisit les données d'identité du client.
2. L'information est transmise à l'interface commerciale qui génère instantanément une **Facture** (sans passer par les étapes Devis ni Commande).
3. Le client se présente à la caisse. Le *Caissier SFC* perçoit les fonds, saisit les coordonnées exactes de la quittance physique issue de son carnet souche.
4. La validation de la quittance passe automatiquement la facture au statut `PAYEE`.
5. Le système génère de manière automatisée le **Bon de Livraison**, permettant au gestionnaire de stock de remettre la marchandise et de décrémenter le stock dans le magasin.

### 4.2 Scénario 2 : Flux "Marchés Publics / État" (Ministères, CTD, Organismes)

Destiné aux structures étatiques rattachées à un Ministère ou une Collectivité locale.

1. L'agent commercial saisit la planification des besoins et émet un **Devis Proforma**.
2. L'entité cliente fait viser l'achat auprès du Contrôle Financier de l'État qui émet un avis de crédit. Le comptable de l'INM enregistre cet **Engagement Budget** (numéro de visa obligatoire).
3. La **Commande** est validée et passe en état de production uniquement si le numéro de visa est valide et couvre le montant total TTC.
4. L'imprimerie exécute le tirage et livre la commande. Le *Gestionnaire de Stock* édite le **Bon de Livraison**. Le client signe pour attester du **"Service Fait"**.
5. L'INM émet la **Facture** finale. Le règlement est perçu ultérieurement par transfert de compte à compte via l'enregistrement d'un numéro de **Virement Trésor**.

### 4.3 Scénario 3 : Flux "Entreprises Corporatives" (Secteur Privé)

Destiné aux sociétés privées, ONG et clients professionnels.

1. Émission d'un **Devis Proforma**.
2. Lors de la validation de la **Commande**, le système interroge automatiquement l'entité **Solvabilité Client** (vérification du plafond d'en-cours maximal autorisé et absence de blocage).
3. L'INM émet la **Facture** dès la commande `VALIDEE` (ou `EN_PREPARATION`), en reprenant les quantités commandées et les prix de la commande — y compris en cas d'acompte, le solde restant exigible.
4. La commande facturée (`FACTUREE`) peut alors être préparée puis livrée : le *Gestionnaire de Stock* édite le **Bon de Livraison** (refusé tant que la commande privée n'est pas facturée) et autorise la sortie des marchandises du dépôt. Le règlement (espèces, chèque ou virement commercial) solde la facture via la caisse.

---

## 5. Données à gérer

Le système orchestre l'intégrité des structures de données suivantes :

- **Données Territoriales :** Indexation exhaustive des Provinces, Régions, Districts, Communes (Urbaines/Rurales) et Fokontany de Madagascar.
- **Données Tiers :** Codes SOA, désignations des ministères, noms des particuliers, raisons sociales d'entreprises, adresses, contacts téléphoniques, CIN et NIF.
- **Données de Risque & Crédit :** Scores de crédit, plafonds de découverts commerciaux, indicateurs binaires de gel de compte.
- **Données Budgétaires Nationales :** Années budgétaires, montants globaux alloués aux institutions, codes d'articles comptables, montants disponibles en lignes de crédit, prévisions de dépenses trimestrielles, numéros uniques de visas financiers.
- **Données Documentaires & Commerciales :** Numéros séquentiels uniques (devis, commandes, préparations, bons de livraison, factures, avoirs), dates de saisie, délais de validité, montants HT, taux et montants de TVA, statuts de paiement, motifs d'avoirs.
- **Données Logistiques & Séries :** Références et désignations des produits finis, prix au catalogue, codes de dépôts/magasins, coordonnées d'emplacements (allées/étagères), quantités en stock physique, quantités bloquées sous réservations, préfixes de séries, bornes numériques de début et de fin de tirage, statuts de production.
- **Données de Caisse & Trésorerie :** Codes de caisse, soldes de caisse, types d'écritures (entrées/sorties), numéros de carnets de quittances (livres), numéros de feuilles (1 à 50), lettres de volets (A à E), numéros de virements Trésor.
- **Données de Sécurité :** Matricules des agents, identifiants de connexion, empreintes de mots de passe hachés, privilèges d'actions, clés de rôles, journaux d'audit (historique immuable des requêtes de modifications).

---

## 6. Règles de gestion (RG)

- **RG-01 (Verrou de la Commande Publique) :** Le système interdit la transition d'une `COMMANDE` vers le statut `EN_PROD` pour les clients de type 'MINISTERE', 'CTD' si le champ `id_engagement` est nul, ou si le montant total TTC de la commande dépasse le `montant_engage` visé par le Contrôle Financier.
- **RG-02 (Sécurisation des En-cours Privés) :** La création d'une `COMMANDE` pour un client de type 'PRIVE' doit être automatiquement bloquée par le back-end si la table `SOLVABILITE_CLIENT` indique un `statut_blocage` égal à vrai (1), ou si le montant TTC de la commande, cumulé à l'en-cours actuel du client, dépasse le `plafond_encours` autorisé.
- **RG-03 (Contrôle d'Unicité de la Matrice SFC) :** L'enregistrement d'une instance dans la table `QUITTANCE` impose une contrainte stricte d'index unique composite sur les attributs `(id_livre, num_feuille, attribut_volet)`. Toute tentative de saisie d'un triplet déjà existant en base de données doit lever une exception fatale et annuler l'encaissement. Le champ `num_feuille` doit être compris entre 1 et 50, et `attribut_volet` doit appartenir strictement à l'ensemble `['A', 'B', 'C', 'D', 'E']`.
- **RG-04 (Algorithme d'Isolation des Séries Sécurisées) :** La validation d'un nouveau `LOT_LANCEMENT_SERIE` pour un produit est conditionnée par l'absence totale de chevauchement numérique. Le système doit exécuter une requête vérifiant qu'il n'existe aucun autre lot pour le même `id_produit` et le même `prefixe_serie` dont la plage `[num_debut, num_fin]` intersecte les bornes du nouveau lot soumis.
- **RG-05 (Intégrité des Mouvements de Stock) :** Toute décrémentation de la `quantite_physique` dans la table `LIGNE_STOCK` via l'insertion d'un `MOUVEMENT_STOCK` de type 'SORTIE\_LIVR' doit être obligatoirement justifiée par un lien valide vers l'identifiant `id_livraison` d'un `BON_LIVRAISON` dûment validé.
- **RG-06 (Facturation Préalable du Client Privé) :** Pour un client de type 'PRIVE', la `FACTURE` précède la livraison : une `COMMANDE` aux statuts `VALIDEE` ou `EN_PREPARATION` est facturable (lignes reprises de la commande) et passe à `FACTUREE` ; un `BON_LIVRAISON` ne peut être édité pour ce client que si la commande est `FACTUREE`. Pour un SOA, la commande doit être `LIVREE` avant d'être facturée (lignes reprises du bon de livraison).

---

## 7. Architecture technique

Le système est conçu sur un modèle d'architecture logicielle découplée (Client/Serveur via API) :

- **Interface Utilisateur (Front-End) : Next.js.** Application monopage dynamique écrite en TypeScript. Elle communique exclusivement par requêtes HTTP asynchrones en transmettant des objets structurés au format JSON. La gestion des rôles de l'interface (affichage ou masquage des boutons et formulaires selon les rôles) est assurée côté client par un contexte d'authentification global.
- **Logique Métier & API (Back-End) : Django REST Framework (DRF).** Moteur d'application écrit en Python. Il contient l'ensemble des règles de validation (méthodes `clean()` des modèles), intercepte les requêtes du front-end, gère les transactions et applique la sécurité. L'authentification des requêtes HTTP est sécurisée par l'émission de jetons **JWT (JSON Web Tokens)** à durée de vie limitée (SimpleJWT).
- **Couche d'Accès aux Données (Base de Données) : Oracle Database.** Système de gestion de base de données relationnelle (SGBDR) garantissant le respect strict des propriétés ACID pour les transactions financières et les écritures de stocks. Django communique avec Oracle via le connecteur officiel Python `oracledb` (ou `cx_Oracle`). L'intégrité de la matrice SFC et des séries industrielles est doublement verrouillée en base par des index uniques composites, des contraintes `CHECK` et des clés d'intégrité référentielle.

---

## 8. Technologies envisagées

- **Front-End :** Next.js, React, TypeScript, TailwindCSS (Design système), Lucide-React (Icônes), Axios / Fetch API.
- **Back-End :** Python, Django, Django REST Framework, Django-REST-Framework-SimpleJWT.
- **Base de Données :** Oracle Database (19c ou supérieur), Driver Python `oracledb`.
- **Déploiement & Environnement :** Docker & Docker-Compose (Conteneurisation des services Next.js et Django), Nginx (Reverse Proxy & chiffrement TLS/SSL), Git (Suivi de versioning).

---

## 9. Contraintes

### 9.1 Contraintes fonctionnelles

- **Rapidité du Comptoir :** L'interface dédiée au *Caissier SFC* pour exécuter l'enregistrement d'une quittance de vente directe doit s'effectuer en moins de 3 clics et être optimisée pour une saisie rapide au clavier (changement de champ via la touche Entrée ou Tabulation).
- **Formatage Administratif :** Le système doit intégrer un moteur d'édition de fichiers PDF (ex: ReportLab ou Weasyprint côté back-end) pour générer des documents commerciaux (Devis, Commandes, Factures, Bons de livraison, Quittances) rigoureusement conformes aux chartes graphiques et exigences juridiques de l'administration malgache.

### 9.2 Contraintes techniques

- **Compatibilité :** L'interface Next.js doit être adaptative (Responsive Design) et s'exécuter sans dégradation visuelle sur les navigateurs web standards (Chrome, Firefox, Microsoft Edge).
- **Indépendance des Types :** Pour assurer la compatibilité avec le moteur Oracle, le type `BOOLEAN` est banni des tables physiques. Les indicateurs binaires (comme le statut d'activation des comptes ou les blocages clients) doivent être représentés par des types `NUMBER(1)` (valeurs 0 ou 1) ou `CHAR(1)` (valeurs 'Y' ou 'N') avec des contraintes `CHECK` associées.

### 9.3 Contraintes de sécurité

- **Authentification :** Les sessions utilisateurs ne doivent pas être persistantes de manière indéfinie. Le jeton d'accès JWT doit expirer après 30 minutes d'inactivité, imposant un renouvellement via un *Refresh Token*. Les mots de passe des comptes applicatifs sont chiffrés en base de données à l'aide de l'algorithme de hachage sécurisé **PBKDF2** ou **Argon2** fourni nativement par Django.
- **Règles RBAC :** L'accès à une route d'API de modification (POST, PUT, DELETE) doit être intercepté par un middleware Django vérifiant la présence du privilège requis (`code_action`) dans le profil de l'utilisateur connecté.
- **Auditabilité :** Toute transaction modifiant les tables du cycle documentaire (`COMMANDE`, `FACTURE`, `REGLEMENT`, `LOT_LANCEMENT_SERIE`) doit générer une ligne d'historique automatique au niveau d'Oracle, traçant l'auteur de la modification, la date et l'ancienne valeur.

---

## 10. Conclusion

Le déploiement du **Système Intégré de Gestion du Cycle Commercial (SIGCC)** permettra à l’Imprimerie Nationale de Madagascar de réussir sa transition numérique en sécurisant ses deux leviers de performance : la rigueur comptable imposée par les finances de l’État et la réactivité commerciale exigée par sa clientèle privée.

En s'appuyant sur un triptyque technologique moderne et éprouvé (**Next.js, Django et Oracle**), cette solution éradiquera les risques de fraude sur les imprimés sécurisés et les quittances physiques, tout en offrant aux agents de l'INM un outil de travail collaboratif, rapide et performant.
