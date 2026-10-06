export interface ProduitRef {
  id_produit: number;
  code_produit: string;
  designation: string;
}

export interface ResumeStock {
  produit: number;
  code_produit: string;
  designation: string;
  quantite_physique: number;
  quantite_reservee: number;
  quantite_disponible: number;
}

export interface LigneStock {
  id: number;
  emplacement: number;
  code_depot: string;
  code_allee: string;
  code_etagere: string;
  produit: number;
  code_produit: string;
  designation: string;
  quantite_physique: number;
  quantite_reservee: number;
  quantite_disponible: number;
}

export interface Magasin {
  id_magasin: number;
  nom_magasin: string;
  code_depot: string;
  nb_emplacements: number;
}

export interface EmplacementStock {
  id_emplacement: number;
  code_allee: string;
  code_etagere: string;
  magasin: number;
  nom_magasin: string;
  code_depot: string;
}

export interface Reservation {
  id_reservation: number;
  quantite_bloquee: number;
  date_limite: string;
  produit: number;
  code_produit: string;
  designation: string;
  preparation: number | null;
  num_commande: string | null;
}

export interface Mouvement {
  id_mouvement: number;
  type_mouvement: string;
  quantite_mouv: number;
  date_mouv: string;
  produit: number;
  code_produit: string;
  designation: string;
  emplacement: number | null;
  code_depot: string | null;
  libelle_emplacement: string | null;
  livraison: number | null;
  num_bl: string | null;
  reference: string | null;
}