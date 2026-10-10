import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { Params } from "@/lib/resource";

/** Comment obtenir le nombre affiché :
 *  count = `count` d'une liste paginée ; length = taille d'une réponse en tableau ;
 *  sum = somme d'un champ sur une liste paginée ; sumArray = somme d'un champ d'une réponse en tableau. */
export type Agg =
  | { type: "count" }
  | { type: "length" }
  | { type: "sum"; field: string }
  | { type: "sumArray"; field: string };

export type Ton = "neutre" | "attention" | "danger" | "succes";

export interface KpiDef {
  key: string;
  label: string;
  path: string;
  params?: () => Params;
  agg?: Agg;
  format?: "nombre" | "ar";
  privilege: string | string[];
  href?: string;
  /** Couleur de la valeur quand elle est supérieure à 0. */
  ton?: Ton;
  /** Rafraîchissement rapide (8 s) pour les files de travail. */
  live?: boolean;
}

export interface ActionDef {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  privilege?: string | string[];
}

export interface QueueRow {
  titre: string;
  detail?: string;
  badge?: ReactNode;
  href?: string;
}

/** Fonction de traduction passée aux constructeurs de lignes (`t("cle", { n })`). */
export type Traduire = (cle: string, params?: Record<string, string | number>) => string;

export interface QueueDef {
  title: string;
  path: string;
  params?: () => Params;
  privilege: string | string[];
  href?: string;                 // lien « Tout voir »
  limit?: number;
  array?: boolean;               // réponse en tableau (non paginée)
  empty: string;
  live?: boolean;
  row: (item: unknown, t: Traduire) => QueueRow;
}

/** Type la fonction `row` sur le vrai type de l'élément. */
export function queue<T>(def: Omit<QueueDef, "row"> & { row: (item: T, t: Traduire) => QueueRow }): QueueDef {
  return def as unknown as QueueDef;
}

export interface RoleDashboardDef {
  role: string;
  titre: string;
  description: string;
  kpis: KpiDef[];
  actions: ActionDef[];
  queues: QueueDef[];
}