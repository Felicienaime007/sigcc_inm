export interface Categorie {
  id_categorie: number;
  libelle_categorie: string;
  nb_produits: number;
}

export interface ProduitCatalogue {
  id_produit: number;
  code_produit: string;
  designation: string;
  prix_tarif: string;
  seuil_alerte: number;
  categorie: number;
  libelle_categorie: string;
  config: number | null;
  numerote_en_serie: boolean;
  prefixe_courant: string | null;
  dernier_numero_valide: number | null;
}

export interface ConfigSerie {
  id_config: number;
  dernier_numero_valide: number;
  prefixe_courant: string | null;
  code_produit: string | null;   // null = série libre, pas encore associée à un produit
  nb_lots: number;
}

export type StatutLot = "PLANIFIE" | "EN_COURS" | "TERMINE" | "ANNULE";

export interface Lot {
  id_lot: number;
  num_lot: string;
  prefixe_serie: string | null;
  num_debut: number;
  num_fin: number;
  quantite_lancee: number;
  date_lancement: string;
  statut_prod: StatutLot;
  config: number;
  produit: number;
  code_produit: string;
  designation: string;
  preparation: number | null;
  num_commande: string | null;
}