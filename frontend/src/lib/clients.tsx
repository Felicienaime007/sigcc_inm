import type { TypeClient } from "@/types/clients";

export const TYPES_CLIENT: { value: TypeClient; label: string }[] = [
  { value: "MINISTERE", label: "Ministère (SOA)" },
  { value: "CTD", label: "Collectivité (SOA)" },
  { value: "PRIVE", label: "Privé" },
  { value: "SIMPLE", label: "Comptoir (simple)" },
];

/** Un SOA (MINISTERE ou CTD) commande avec un code SOA, un organisme et une adresse administrative. */
export const estSoa = (type: string) => type === "MINISTERE" || type === "CTD";

export const libelleType = (type: string) =>
  TYPES_CLIENT.find((t) => t.value === type)?.label ?? type;

/** Nombre saisi par l'utilisateur ("1 500,5" ou "1500.5") → number (NaN si invalide). */
export const versNombre = (s: string) => Number(s.trim().replace(/\s/g, "").replace(",", "."));

// ---------------------------------------------------------------- Droits par type
type Can = (requis?: string | string[]) => boolean;
export type ActionClient = "create" | "update" | "delete";

const NON_SIMPLES: TypeClient[] = ["MINISTERE", "CTD", "PRIVE"];

/** Types autorisés dans le circuit commercial (devis, commandes, planifications…) : jamais SIMPLE. */
export const TYPES_COMMERCIAL: TypeClient[] = ["MINISTERE", "CTD", "PRIVE"];

/** Type unique du comptoir / réception : le client de passage. */
export const TYPE_COMPTOIR: TypeClient = "SIMPLE";

/** Types qu'un utilisateur peut créer / modifier / supprimer (miroir des règles du backend). */
export function typesGerables(can: Can, action: ActionClient): TypeClient[] {
  const types: TypeClient[] = [];
  if (can(`client.${action}`)) types.push(...NON_SIMPLES);
  if (can(`client_simple.${action}`)) types.push("SIMPLE");
  return types;
}

export const peutGerer = (can: Can, type: string, action: ActionClient) =>
  typesGerables(can, action).includes(type as TypeClient);

/** Types qu'un utilisateur peut consulter. */
export function typesVisibles(can: Can): TypeClient[] {
  const types: TypeClient[] = [];
  if (can("client.view")) types.push(...NON_SIMPLES);
  if (can("client_simple.view")) types.push("SIMPLE");
  return types;
}