export const STATUTS_LOT = [
  { value: "PLANIFIE", label: "Planifié" },
  { value: "EN_COURS", label: "En cours" },
  { value: "TERMINE", label: "Terminé" },
  { value: "ANNULE", label: "Annulé" },
];

/** « QT 801 → 1100 » */
export const formatPlage = (prefixe: string | null, debut: number, fin: number) =>
  `${prefixe ? `${prefixe} ` : ""}${debut} → ${fin}`;

export const MAX_LOT = 1_000_000;