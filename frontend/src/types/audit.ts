export type OperationAudit = "CREATE" | "UPDATE" | "DELETE";

export interface AuditEntry {
  id_audit: number;
  date_audit: string;
  id_utilisateur: number | null;
  identifiant_utilisateur: string;     // SYSTEME ou ANONYME pour les opérations hors utilisateur
  operation: OperationAudit;
  table_nom: string;
  id_objet: string;
  reference: string | null;
  ancienne_valeur: Record<string, unknown> | null;
  nouvelle_valeur: Record<string, unknown> | null;
  adresse_ip: string | null;
}