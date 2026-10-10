export interface TypeFinancement {
  id_type_financement: number;
  libelle_financement: string;
}

export interface Budget {
  id_budget: number;
  annee_budgetaire: number;
  montant_alloue: string;
  organisme: number;
  nom_organisme: string;
  nb_lignes: number;
  total_disponible: string | null;   // null tant que le budget n'a aucune ligne
  total_engage: string;              // agrégé serveur sur toutes les lignes
}

export interface LigneBudget {
  id_ligne_budget: number;
  code_article: string;
  libelle_ligne: string;
  montant_disponible: string;
  budget: number;
  annee_budgetaire: number;
  nom_organisme: string;
  type_financement: number | null;
  libelle_financement: string | null;
  nb_engagements: number;
  total_engage: string;              // engagements visés + soldés (annulés exclus)
}

export interface Prevision {
  id_prevision: number;
  montant_estime: string;
  periode: string;
  ligne_budget: number;
  code_article: string;
}

export interface Engagement {
  id_engagement: number;
  num_engagement_cf: string;
  montant_engage: string;
  date_visa_cf: string;
  statut_engagement: "VISE" | "SOLDE" | "ANNULE";
  ligne_budget: number;
  code_article: string;
  annee_budgetaire: number;
  nom_organisme: string;
  client: number;
  nom_client: string;
  code_soa: string | null;
  id_commande: number | null;
}

export const STATUTS_ENGAGEMENT = [
  { value: "VISE", label: "budget.statuts.vise" },
  { value: "SOLDE", label: "budget.statuts.solde" },
  { value: "ANNULE", label: "budget.statuts.annule" },
];

/** Dotation d'une ligne = ce qui reste + ce qui est engagé. */
export const dotation = (l: Pick<LigneBudget, "montant_disponible" | "total_engage">) =>
  Number(l.montant_disponible) + Number(l.total_engage);