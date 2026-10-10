export type NiveauNotif = "INFO" | "ATTENTION" | "URGENT";

export interface Notif {
  id_notification: number;
  type_notif: string;
  niveau: NiveauNotif;
  titre: string;
  message: string | null;
  lien: string | null;
  cree_le: string;
  lu: boolean;
  lu_le: string | null;
}

export interface ResumeNotifs {
  non_lues: number;
  derniere: number;
  nouvelles: Notif[];
  recentes: Notif[];
}

export interface TypePreference {
  type: string;
  libelle: string;
  description: string;
  niveau: NiveauNotif;
  obligatoire: boolean;
  active: boolean;
}