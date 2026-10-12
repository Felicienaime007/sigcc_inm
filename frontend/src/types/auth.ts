export interface Profil {
  id_utilisateur: number;
  matricule: string;
  nom_complet: string;
  identifiant: string;
  statut_compte: string;
  photo: string | null;
  roles: string[];
  privileges: string[];
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: Profil;
}