export const TVA_TAUX = Number(process.env.NEXT_PUBLIC_TVA_TAUX ?? "0.2");

type T = (cle: string, params?: Record<string, string | number>) => string;

export const STATUTS_PAIEMENT = [
  { value: "NON_PAYEE", label: "commercial.listes.paiement_non_payee" },
  { value: "PARTIELLE", label: "commercial.listes.paiement_partielle" },
  { value: "PAYEE", label: "commercial.listes.paiement_payee" },
  { value: "ANNULEE", label: "commercial.listes.paiement_annulee" },
];

export const TYPES_FACTURATION = [
  { value: "QUITTANCE", label: "commercial.listes.facturation_quittance" },
  { value: "VIREMENT_TRESOR", label: "commercial.listes.facturation_virement" },
];

const FR_FACTURATION: Record<string, string> = {
  QUITTANCE: "Quittance (caisse)",
  VIREMENT_TRESOR: "Virement du Trésor",
};

export const libelleFacturation = (v: string, t?: T) => {
  const o = TYPES_FACTURATION.find((x) => x.value === v);
  if (!o) return v;
  return t ? t(o.label) : (FR_FACTURATION[v] ?? v);
};

/** Entier positif saisi dans un champ texte ; null si invalide. */
export function entierPositif(s: string): number | null {
  const v = s.trim();
  if (!/^\d+$/.test(v)) return null;
  const n = Number(v);
  return n >= 1 ? n : null;
}
export const STATUTS_COMMANDE = [
  { value: "BROUILLON", label: "commercial.listes.commande_brouillon" },
  { value: "VALIDEE", label: "commercial.listes.commande_validee" },
  { value: "EN_PREPARATION", label: "commercial.listes.commande_en_preparation" },
  { value: "LIVREE", label: "commercial.listes.commande_livree" },
  { value: "FACTUREE", label: "commercial.listes.commande_facturee" },
  { value: "ANNULEE", label: "commercial.listes.commande_annulee" },
];
