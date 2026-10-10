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

export interface Relance {
  id_relance: number;
  date_relance: string;
  niveau: number;
  nature: "OUVERTURE" | "RELANCE" | "ESCALADE";
  canal: string;
  commentaire: string;
  auteur: number | null;
  auteur_nom: string | null;
}

export const CANAUX_RELANCE = [
  { value: "TELEPHONE", label: "recouvrement.canaux.telephone" },
  { value: "EMAIL", label: "recouvrement.canaux.email" },
  { value: "COURRIER", label: "recouvrement.canaux.courrier" },
  { value: "VISITE", label: "recouvrement.canaux.visite" },
  { value: "SMS", label: "recouvrement.canaux.sms" },
  { value: "AUTRE", label: "recouvrement.canaux.autre" },
];

export const libelleCanal = (c: string) =>
  CANAUX_RELANCE.find((x) => x.value === c)?.label ?? c;

export const libelleNatureRelance = (n: string) =>
  n === "OUVERTURE"
    ? "recouvrement.natures.ouverture"
    : n === "ESCALADE"
      ? "recouvrement.natures.escalade"
      : "recouvrement.natures.relance";

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
  relances: Relance[];
}