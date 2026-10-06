export interface Impaye {
  facture: number;
  num_facture: string;
  client: number;
  nom_client: string;
  date_facture: string;
  echeance: string;
  jours_retard: number;
  montant_du: string;          // décimal renvoyé en chaîne
  statut_paiement: string;
}

export interface LigneDossier {
  facture: number;
  num_facture: string;
  date_facture: string;
  echeance: string;
  jours_retard: number;
  montant_a_recouvrer: string;
}

export type StatutDossier = "EN_COURS" | "REGLE" | "CONTENTIEUX";

export interface Dossier {
  id_recouvrement: number;
  num_dossier: string;
  date_relance: string;
  niveau_relance: 1 | 2 | 3;
  statut_dossier: StatutDossier;
  client: number | null;
  nom_client: string | null;
  total_a_recouvrer: string | number;
  lignes: LigneDossier[];
}