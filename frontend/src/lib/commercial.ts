export const TVA_TAUX = Number(process.env.NEXT_PUBLIC_TVA_TAUX ?? "0.2");

export const STATUTS_PAIEMENT = [
  { value: "NON_PAYEE", label: "Non payée" },
  { value: "PARTIELLE", label: "Partiellement payée" },
  { value: "PAYEE", label: "Payée" },
];

export const TYPES_FACTURATION = [
  { value: "QUITTANCE", label: "Quittance (caisse)" },
  { value: "VIREMENT_TRESOR", label: "Virement du Trésor" },
];

export const libelleFacturation = (t: string) =>
  TYPES_FACTURATION.find((x) => x.value === t)?.label ?? t;

/** Entier positif saisi dans un champ texte ; null si invalide. */
export function entierPositif(s: string): number | null {
  const v = s.trim();
  if (!/^\d+$/.test(v)) return null;
  const n = Number(v);
  return n >= 1 ? n : null;
}
export const STATUTS_COMMANDE = [
  { value: "BROUILLON", label: "Brouillon" },
  { value: "VALIDEE", label: "Validée" },
  { value: "EN_PREPARATION", label: "En préparation" },
  { value: "LIVREE", label: "Livrée" },
  { value: "FACTUREE", label: "Facturée" },
  { value: "ANNULEE", label: "Annulée" },
];