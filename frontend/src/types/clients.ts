export type TypeClient = "MINISTERE" | "CTD" | "PRIVE" | "SIMPLE";

export interface FicheSolvabilite {
  id_solvabilite: number;
  score_credit: string;       // décimal renvoyé en chaîne par l'API : "72.50"
  plafond_encours: string;
  statut_blocage: boolean;
}

export interface Client {
  id_client: number;
  code_soa: string | null;
  nom_client: string;
  type_client: TypeClient;
  adresse: string | null;
  telephone: string | null;
  cin_ou_nif: string | null;
  /** PRIVE et SIMPLE : ville. SOA : null. */
  ville: string | null;
  /** SOA : fokontany de l'adresse administrative. PRIVE et SIMPLE : null. */
  fokontany: number | null;
  nom_fokontany: string | null;
  nom_commune: string | null;
  nom_district: string | null;
  nom_region: string | null;
  organisme: number | null;
  nom_organisme: string | null;
  /** « Fokontany, commune » pour un SOA ; la ville sinon. */
  localisation: string;
  /** Absent (et non null) quand le client n'a pas de fiche : on teste donc `!client.solvabilite`. */
  solvabilite?: FicheSolvabilite | null;
}

export interface Organisme {
  id_organisme: number;
  nom_organisme: string;
  code_institutionnel: string;
  nb_clients: number;
}

export interface SolvabiliteListe extends FicheSolvabilite {
  client: number;
  nom_client: string;
}