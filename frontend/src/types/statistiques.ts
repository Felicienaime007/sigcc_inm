export interface Ventes {
  ht: number; tva: number; ttc: number; nb_factures: number;
  avoirs_ht: number; ca_net: number; ca_net_precedent: number;
  mensuel_facture: number[]; mensuel_avoirs: number[];
  par_type_client: { type: string; ht: number; n: number }[];
  top_clients: { client: number; nom_client: string; ht: number; n: number }[];
  top_produits: { produit: number; code_produit: string; designation: string; quantite: number; ca: number }[];
  par_statut_paiement: { statut: string; n: number; ht: number }[];
}

export interface Encaissements {
  total: number; nb: number; mensuel: number[];
  par_mode: { mode: string; total: number; n: number }[];
}

export interface Creances {
  total: number; nb: number; en_retard: number; nb_en_retard: number;
  tranches: { cle: string; label: string; total: number; n: number }[];
  par_mode: { type_facturation: string; total: number; n: number }[];
}

export interface BudgetStats {
  annee: number; alloue: number; dotation: number; engage: number; disponible: number;
  organismes: { organisme: string; alloue: number; dotation: number; engage: number; disponible: number; taux: number }[];
}

export interface StockStats {
  valeur: number; nb_produits_en_stock: number; nb_ruptures: number; sans_stock: number;
  plus_faibles: { produit: number; code_produit: string; designation: string; physique: number; reserve: number; disponible: number }[];
}

export interface Tableau {
  annee: number;
  annees: number[];
  ventes: Ventes | null;
  encaissements: Encaissements | null;
  creances: Creances | null;
  commandes: { par_statut: { statut: string; n: number }[] } | null;
  budget: BudgetStats | null;
  stock: StockStats | null;
  production: { a_faire: number; par_statut: { statut: string; n: number; quantite: number }[] } | null;
  recouvrement: {
    montant_actif: number;
    par_statut: { statut: string; n: number }[];
    par_niveau: { niveau: number; n: number }[];
  } | null;
  caisses: { total: number; nb: number } | null;
}