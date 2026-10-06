export type StatutPaiement = "NON_PAYEE" | "PARTIELLE" | "PAYEE";

export interface Produit {
  id_produit: number;
  code_produit: string;
  designation: string;
  prix_tarif: string;
  libelle_categorie: string;
}

export interface StockResume {
  produit: number;
  code_produit: string;
  quantite_physique: number;
  quantite_reservee: number;
  quantite_disponible: number;
}

export interface Emplacement {
  id_emplacement: number;
  code_allee: string;
  code_etagere: string;
  code_depot: string;
}

export interface LigneFacture {
  produit: number;
  code_produit: string;
  designation: string;
  quantite_facturee: number;
  prix_unitaire: string;
}

export interface Facture {
  id_facture: number;
  num_facture: string;
  date_facture: string;
  montant_ht: string;
  tva: string;
  montant_ttc: string;
  type_facturation: "QUITTANCE" | "VIREMENT_TRESOR";
  statut_paiement: StatutPaiement;
  commande: number | null;
  num_commande: string | null;
  client: number | null;       // renseigné pour une vente comptoir seulement
  nom_client: string;
  type_client: string;
  id_livraison: number | null;
  lignes: LigneFacture[];
  total_regle: string;
  reste_a_payer: string;
}

export interface LigneLivraison {
  produit: number;
  code_produit: string;
  designation: string;
  quantite_livree: number;
}

export interface BonLivraison {
  id_livraison: number;
  num_bl: string;
  date_livraison: string;
  preparation: number | null;
  facture: number | null;
  num_commande: string | null;
  nom_client: string;
  lignes: LigneLivraison[];
}

export interface LigneAvoir {
  produit: number;
  code_produit: string;
  designation: string;
  quantite_retournee: number;
  montant_avoir: string;
}

export interface Avoir {
  id_avoir: number;
  num_avoir: string;
  date_avoir: string;
  motif: string;
  facture: number;
  num_facture: string;
  lignes: LigneAvoir[];
  total_avoir: string;
}

export interface LignePreparation {
  produit: number;
  code_produit: string;
  designation: string;
  quantite_preparee: number;
}

export interface Preparation {
  id_preparation: number;
  date_prepa: string;
  statut_prepa: "EN_COURS" | "PRETE" | "LIVREE";
  commande: number;
  num_commande: string;
  nom_client: string;
  lignes: LignePreparation[];
  id_livraison: number | null;
}

export interface CommandeLight {
  id_commande: number;
  num_commande: string;
  nom_client: string;
}
export interface LigneDevis {
  produit: number;
  code_produit: string;
  designation: string;
  quantite: number;
  prix_unitaire_devis: string;
}

export interface Devis {
  id_devis: number;
  num_devis: string;
  date_devis: string;
  validite_jours: number;
  date_expiration: string;
  est_expire: boolean;
  client: number;
  nom_client: string;
  lignes: LigneDevis[];
  total: string;
  id_commande: number | null;
}

export interface LigneCommande {
  produit: number;
  code_produit: string;
  designation: string;
  quantite_commandee: number;
  prix_unitaire_facture: string;
}

export interface Commande {
  id_commande: number;
  num_commande: string;
  date_commande: string;
  statut_commande: string;
  client: number;
  nom_client: string;
  type_client: string;
  devis: number | null;
  num_devis: string | null;
  engagement: number | null;
  num_engagement_cf: string | null;
  lignes: LigneCommande[];
  total: string;
}

export interface LignePlanification {
  produit: number;
  code_produit: string;
  designation: string;
  quantite_estimee: number;
}

export interface Planification {
  id_planification: number;
  date_planif: string;
  periode_cible: string;
  client: number;
  nom_client: string;
  lignes: LignePlanification[];
}

export interface EngagementLight {
  id_engagement: number;
  num_engagement_cf: string;
  montant_engage: string;
  code_article: string;
  annee_budgetaire: number;
  statut_engagement: string;
  id_commande: number | null;
}