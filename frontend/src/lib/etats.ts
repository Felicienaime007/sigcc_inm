import { Banknote, Hourglass, Landmark, ShoppingBag, Wallet, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { api } from "./api";
import { aujourdhui, anneeCourante } from "./dates";
import { getErrorMessageAsync } from "./errors";

export type PeriodeType = "plage" | "annee" | "aucune";

export interface FiltreDef {
  cle: string;
  label: string;
  /** « select » : choix fixes ; « distant » : liste chargée depuis l'API. */
  type: "select" | "distant";
  options?: { value: string; label: string }[];
  path?: string;
  idKey?: string;
  labelKey?: string;
  privilege?: string;       // le filtre n'est proposé qu'avec ce privilège
}

export interface EtatDef {
  code: string;
  titre: string;
  description: string;
  privilege: string;
  icone: LucideIcon;
  periode: PeriodeType;
  filtres: FiltreDef[];
}

const TYPES_CLIENT = [
  { value: "MINISTERE", label: "etats.opt.ministere" },
  { value: "CTD", label: "etats.opt.ctd" },
  { value: "PRIVE", label: "etats.opt.prive" },
  { value: "SIMPLE", label: "etats.opt.simple" },
];

const MODES_REGLEMENT = [
  { value: "ESPECES", label: "etats.opt.especes" },
  { value: "CHEQUE", label: "etats.opt.cheque" },
  { value: "VIREMENT_TRESOR", label: "etats.opt.virement" },
];

const CAISSE: FiltreDef = {
  cle: "caisse", label: "etats.filtres.caisse", type: "distant", path: "tresorerie/caisses",
  idKey: "id_caisse", labelKey: "code_caisse", privilege: "caisse.view",
};

export const CATALOGUE: EtatDef[] = [
  {
    code: "ventes", titre: "etats.etats.ventes.titre", icone: ShoppingBag,
    description: "etats.etats.ventes.description",
    privilege: "etat_ventes.view", periode: "plage",
    filtres: [
      { cle: "type_client", label: "etats.filtres.type_client", type: "select", options: TYPES_CLIENT },
      {
        cle: "statut", label: "etats.filtres.paiement", type: "select",
        options: [
          { value: "NON_PAYEE", label: "etats.opt.non_payees" },
          { value: "PARTIELLE", label: "etats.opt.partielles" },
          { value: "PAYEE", label: "etats.opt.payees" },
        ],
      },
      {
        cle: "mode", label: "etats.filtres.mode_facturation", type: "select",
        options: [{ value: "QUITTANCE", label: "etats.opt.quittance" }, { value: "VIREMENT_TRESOR", label: "etats.opt.virement_tresor" }],
      },
    ],
  },
  {
    code: "encaissements", titre: "etats.etats.encaissements.titre", icone: Banknote,
    description: "etats.etats.encaissements.description",
    privilege: "etat_encaissements.view", periode: "plage",
    filtres: [{ cle: "mode", label: "etats.filtres.mode_reglement", type: "select", options: MODES_REGLEMENT }, CAISSE],
  },
  {
    code: "balance-agee", titre: "etats.etats.balance.titre", icone: Hourglass,
    description: "etats.etats.balance.description",
    privilege: "etat_creances.view", periode: "aucune",
    filtres: [{ cle: "type_client", label: "Type de client", type: "select", options: TYPES_CLIENT }],
  },
  {
    code: "caisse", titre: "etats.etats.caisse.titre", icone: Landmark,
    description: "etats.etats.caisse.description",
    privilege: "etat_caisse.view", periode: "plage",
    filtres: [CAISSE],
  },
  {
    code: "budget", titre: "etats.etats.budget.titre", icone: Wallet,
    description: "etats.etats.budget.description",
    privilege: "etat_budget.view", periode: "annee",
    filtres: [{
      cle: "organisme", label: "etats.filtres.organisme", type: "distant", path: "clients/organismes",
      idKey: "id_organisme", labelKey: "nom_organisme", privilege: "organisme.view",
    }],
  },
];

// ----------------------------------------------------------------- Périodes
function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type PeriodeRapide = "jour" | "mois" | "mois_dernier" | "trimestre" | "annee";

export const PERIODES_RAPIDES: { cle: PeriodeRapide; label: string }[] = [
  { cle: "jour", label: "etats.periodes.jour" },
  { cle: "mois", label: "etats.periodes.mois" },
  { cle: "mois_dernier", label: "etats.periodes.mois_dernier" },
  { cle: "trimestre", label: "etats.periodes.trimestre" },
  { cle: "annee", label: "etats.periodes.annee" },
];

export function periodeRapide(cle: PeriodeRapide): { du: string; au: string } {
  const [y, m, j] = aujourdhui().split("-").map(Number);
  const jour = new Date(Date.UTC(y, m - 1, j));
  switch (cle) {
    case "jour": return { du: iso(jour), au: iso(jour) };
    case "mois": return { du: iso(new Date(Date.UTC(y, m - 1, 1))), au: iso(jour) };
    case "mois_dernier":
      return { du: iso(new Date(Date.UTC(y, m - 2, 1))), au: iso(new Date(Date.UTC(y, m - 1, 0))) };
    case "trimestre":
      return { du: iso(new Date(Date.UTC(y, Math.floor((m - 1) / 3) * 3, 1))), au: iso(jour) };
    case "annee": return { du: iso(new Date(Date.UTC(y, 0, 1))), au: iso(jour) };
  }
}

export function valeursParDefaut(def: EtatDef): Record<string, string> {
  if (def.periode === "plage") return periodeRapide("mois");
  if (def.periode === "annee") return { annee: String(anneeCourante()) };
  return {};
}

// ------------------------------------------------------------------ Export
export type FormatExport = "xlsx" | "csv" | "pdf";

const TYPES_MIME: Record<FormatExport, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv;charset=utf-8",
  pdf: "application/pdf",
};

export async function exporter(
  code: string,
  params: Record<string, string>,
  format: FormatExport,
  txt?: { impossible: string; generation: string },
): Promise<void> {
  const impossible = txt?.impossible ?? "Export impossible.";
  const generation = txt?.generation ?? "Génération de l'état…";
  // Le PDF s'ouvre dans un onglet (fenêtre ouverte pendant le clic pour ne pas être bloquée)
  const fenetre = format === "pdf" ? window.open("", "_blank") : null;
  if (fenetre) fenetre.document.body.innerHTML = `<p style='font-family:sans-serif;padding:2rem'>${generation}</p>`;
  try {
    const { data } = await api.get<Blob>(`/etats/${code}/`, {
      params: { ...params, export: format },
      responseType: "blob",
    });
    const url = URL.createObjectURL(new Blob([data], { type: TYPES_MIME[format] }));
    if (fenetre) {
      fenetre.location.href = url;
    } else {
      const lien = document.createElement("a");
      lien.href = url;
      lien.download = [code, params.du, params.au, params.annee].filter(Boolean).join("_") + `.${format}`;
      lien.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
  } catch (e) {
    fenetre?.close();
    toast.error(await getErrorMessageAsync(e, impossible));
  }
}