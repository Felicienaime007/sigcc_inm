export interface Caisse {
  id_caisse: number;
  code_caisse: string;
  libelle_caisse: string;
  solde_actuel: string;
}

export interface Livre {
  id_livre: number;
  numero_livre: string;
  annee_ouverture: number;
  statut_livre: "EN_COURS" | "EPUISE";
  nb_utilisees: number;
  nb_restantes: number;
}

export interface QuittanceRef {
  numero_livre: string;
  num_feuille: number;
  attribut_volet: string;
  code_caisse: string;
  statut: "EMISE" | "ANNULEE";
}

export interface Reglement {
  id_reglement: number;
  mode_reglement: "ESPECES" | "CHEQUE" | "VIREMENT_TRESOR";
  date_reglement: string;
  montant_regle: string;
  num_virement_tresor: string | null;
  facture: number;
  num_facture: string;
  statut_paiement_facture: string;
  reste_a_payer: string;
  quittance: QuittanceRef | null;
  statut: "ACTIF" | "ANNULE";
  motif_annulation: string | null;
  date_annulation: string | null;
}

export interface Quittance {
  id_quittance: number;
  livre: number;
  numero_livre: string;
  num_feuille: number;
  attribut_volet: string;
  date_emission: string;
  caisse: number;
  code_caisse: string;
  statut: "EMISE" | "ANNULEE";
  reglement: number | null;
  num_facture: string | null;
  montant_regle: string | null;
}

export interface EcritureCaisse {
  id_livre_caisse: number;
  date_operation: string;
  type_operation: "ENTREE" | "SORTIE";
  montant_op: string;
  caisse: number;
  code_caisse: string;
  reglement: number | null;
  num_facture: string | null;
  reference: string | null;
}

export interface RemiseLiee {
  id_remise: number;
  reference_bordereau: string;
  montant: string;
  statut: "PREPAREE" | "REMISE";
}

export interface ArreteCaisse {
  id_arrete: number;
  caisse: number;
  code_caisse: string;
  date_arrete: string;
  total_entrees: string;
  total_sorties: string;
  solde_theorique: string;
  montant_compte: string;
  ecart: string;
  detail_billets: string | null;
  statut: "BROUILLON" | "VALIDE";
  date_validation: string | null;
  remises: RemiseLiee[];
}

export interface RemiseBanque {
  id_remise: number;
  caisse: number;
  code_caisse: string;
  date_remise: string;
  montant: string;
  reference_bordereau: string;
  modes: string;
  statut: "PREPAREE" | "REMISE";
  date_statut: string | null;
  arrete: number | null;
  date_arrete: string | null;
}

export const MODES_REGLEMENT = [
  { value: "ESPECES", label: "Espèces" },
  { value: "CHEQUE", label: "Chèques" },
  { value: "VIREMENT_TRESOR", label: "Virement du Trésor" },
];

/** Coupures officielles de l'Ariary pour le comptage physique (miroir du backend). */
export const COUPURES = [20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10];

/** {"20000": 3, ...} -> Record, ou null si texte libre historique / vide. */
export function lireComptage(detail: string | null): Record<number, number> | null {
  if (!detail || !detail.trim()) return {};
  try {
    const donnees = JSON.parse(detail) as unknown;
    if (typeof donnees !== "object" || donnees === null || Array.isArray(donnees)) return null;
    const resultat: Record<number, number> = {};
    for (const [k, v] of Object.entries(donnees as Record<string, unknown>)) {
      const valeur = Number(k);
      if (!COUPURES.includes(valeur) || typeof v !== "number" || !Number.isInteger(v) || v < 0) return null;
      if (v > 0) resultat[valeur] = v;
    }
    return resultat;
  } catch {
    return null;
  }
}

export function totalComptage(comptage: Record<number, number>): number {
  return Object.entries(comptage).reduce((t, [coupure, qte]) => t + Number(coupure) * qte, 0);
}

/** Clés i18n des modes de règlement (`tresorerie.modes.*`). Les libellés FR ci-dessus restent la source. */
export const CLES_MODES: Record<string, string> = {
  ESPECES: "tresorerie.modes.especes",
  CHEQUE: "tresorerie.modes.cheques",
  VIREMENT_TRESOR: "tresorerie.modes.virement_tresor",
};

export const libelleMode = (m: string) => CLES_MODES[m] ?? m;