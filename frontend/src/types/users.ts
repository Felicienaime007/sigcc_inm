export type StatutCompte = "ACTIF" | "INACTIF" | "SUSPENDU";

export interface RoleLight {
  id_role: number;
  libelle_role: string;
}

export interface Utilisateur {
  id_utilisateur: number;
  matricule: string;
  nom_complet: string;
  identifiant: string;
  statut_compte: StatutCompte;
  photo: string | null;
  roles: RoleLight[];
  last_login: string | null;
}

export interface Privilege {
  id_privilege: number;
  code_action: string;
  description: string | null;
}

export interface Role {
  id_role: number;
  libelle_role: string;
  privileges: Privilege[];
  nb_utilisateurs: number;
}