import { formatAr, formatDate, formatDateTime, formatNombre } from "@/lib/format";

export const OPERATIONS = [
  { value: "CREATE", label: "Création" },
  { value: "UPDATE", label: "Modification" },
  { value: "DELETE", label: "Suppression" },
];

export const libelleOperation = (o: string) => OPERATIONS.find((x) => x.value === o)?.label ?? o;

const TABLES: Record<string, string> = {
  commande: "Commande",
  facture: "Facture",
  reglement: "Règlement",
  lot_lancement_serie: "Lot de production",
  engagement_budget: "Engagement budgétaire",
  quittance: "Quittance",
  caisse: "Caisse",
  recouvrement: "Dossier de recouvrement",
  solvabilite_client: "Solvabilité client",
  // si ces tables sont ajoutées au registre d'audit (apps/audit/registry.py)
  client: "Client",
  produit_fini: "Produit",
  mouvement_stock: "Mouvement de stock",
  utilisateur_role: "Rôle d'utilisateur",
  role_privilege: "Privilège de rôle",
};
export const libelleTable = (t: string) => TABLES[t] ?? t;

const CHAMPS: Record<string, string> = {
  statut_commande: "Statut", statut_paiement: "Statut de paiement", statut_prod: "Statut de production",
  statut_engagement: "Statut", statut_dossier: "Statut du dossier", statut_blocage: "Client bloqué",
  num_commande: "N° de commande", num_facture: "N° de facture", num_lot: "N° de lot",
  num_engagement_cf: "N° d'engagement (CF)", num_dossier: "N° de dossier", num_virement_tresor: "N° de virement",
  date_commande: "Date de commande", date_facture: "Date de facture", date_reglement: "Date du règlement",
  date_lancement: "Date de lancement", date_visa_cf: "Date de visa du CF", date_relance: "Dernière relance",
  date_emission: "Date d'émission",
  montant_ht: "Montant HT", tva: "TVA", montant_regle: "Montant réglé", montant_engage: "Montant engagé",
  montant_a_recouvrer: "Montant à recouvrer", montant_disponible: "Montant disponible", solde_actuel: "Solde",
  type_facturation: "Mode de facturation", mode_reglement: "Mode de règlement",
  niveau_relance: "Niveau de relance", quantite_lancee: "Quantité lancée",
  num_debut: "Premier numéro", num_fin: "Dernier numéro", prefixe_serie: "Préfixe de série",
  plafond_encours: "Plafond d'encours", score_credit: "Score de crédit",
  num_feuille: "Feuille", attribut_volet: "Volet",
  code_caisse: "Code de la caisse", libelle_caisse: "Libellé de la caisse",
};

export function libelleChamp(champ: string): string {
  if (CHAMPS[champ]) return CHAMPS[champ];
  const brut = champ.endsWith("_id") ? `${champ.slice(0, -3)} (n°)` : champ;
  const texte = brut.replaceAll("_", " ");
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

const MONTANT = /(montant|tva|solde|prix|plafond|total)/;
const DATE_HEURE = /^\d{4}-\d{2}-\d{2}T/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Texte lisible d'une valeur d'audit (les décimaux arrivent en chaînes : « 1340000.00 »). */
export function formatValeur(champ: string, valeur: unknown): string {
  if (valeur === null || valeur === undefined || valeur === "") return "—";
  if (typeof valeur === "boolean") return valeur ? "Oui" : "Non";
  if (typeof valeur === "number" || (typeof valeur === "string" && /^-?\d+(\.\d+)?$/.test(valeur))) {
    return MONTANT.test(champ) ? formatAr(valeur as string | number) : formatNombre(valeur as string | number);
  }
  if (typeof valeur === "string") {
    if (DATE_HEURE.test(valeur)) return formatDateTime(valeur);
    if (DATE.test(valeur)) return formatDate(valeur);
    return valeur.replaceAll("_", " ").length === valeur.length || !/^[A-Z_]+$/.test(valeur)
      ? valeur
      : (valeur.charAt(0) + valeur.slice(1).toLowerCase()).replaceAll("_", " ");
  }
  return JSON.stringify(valeur);
}

/** Résumé d'une ligne du journal pour la liste. */
export function resume(op: string, avant: Record<string, unknown> | null, apres: Record<string, unknown> | null): string {
  if (op === "CREATE") return "Création du document";
  if (op === "DELETE") return "Suppression du document";
  const champs = Object.keys(apres ?? avant ?? {});
  return champs.length ? champs.map(libelleChamp).join(", ") : "—";
}