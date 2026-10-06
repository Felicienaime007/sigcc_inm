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

export const MODES_REGLEMENT = [
  { value: "ESPECES", label: "Espèces" },
  { value: "CHEQUE", label: "Chèque" },
  { value: "VIREMENT_TRESOR", label: "Virement du Trésor" },
];

export const libelleMode = (m: string) => MODES_REGLEMENT.find((x) => x.value === m)?.label ?? m;