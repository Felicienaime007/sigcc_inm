export type TypeColonne = "texte" | "date" | "datetime" | "montant" | "nombre" | "pourcent";

export interface ColonneEtat {
  cle: string;
  label: string;
  type: TypeColonne;
  poids: number;
}

export interface LigneSynthese {
  label: string;
  nombre?: number | null;
  montant?: string | null;
}

export type ValeurEtat = string | number | null;

export interface Etat {
  code: string;
  titre: string;
  sous_titre: string;
  colonnes: ColonneEtat[];
  lignes: Record<string, ValeurEtat>[];
  total_lignes: number;
  tronque: boolean;
  totaux: Record<string, ValeurEtat>;
  synthese: LigneSynthese[];
  fichier: string;
}