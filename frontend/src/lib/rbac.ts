import type { Privilege } from "@/types/users";

/** Libellés français des modules (préfixe d'un code « module.action »). */
const MODULES: Record<string, string> = {
  utilisateur: "admin.rbac.modules.utilisateur",
  role: "admin.rbac.modules.role",
  privilege: "admin.rbac.modules.privilege",
  province: "admin.rbac.modules.province",
  region: "admin.rbac.modules.region",
  district: "admin.rbac.modules.district",
  commune: "admin.rbac.modules.commune",
  fokontany: "admin.rbac.modules.fokontany",
  client: "admin.rbac.modules.client",
  organisme: "admin.rbac.modules.organisme",
  solvabilite: "admin.rbac.modules.solvabilite",
  type_financement: "admin.rbac.modules.type_financement",
  budget: "admin.rbac.modules.budget",
  ligne_budgetaire: "admin.rbac.modules.ligne_budgetaire",
  prevision: "admin.rbac.modules.prevision",
  engagement: "admin.rbac.modules.engagement",
  categorie: "admin.rbac.modules.categorie",
  produit: "admin.rbac.modules.produit",
  config_serie: "admin.rbac.modules.config_serie",
  lot: "admin.rbac.modules.lot",
  planification: "admin.rbac.modules.planification",
  devis: "admin.rbac.modules.devis",
  commande: "admin.rbac.modules.commande",
  preparation: "admin.rbac.modules.preparation",
  livraison: "admin.rbac.modules.livraison",
  facture: "admin.rbac.modules.facture",
  avoir: "admin.rbac.modules.avoir",
  magasin: "admin.rbac.modules.magasin",
  emplacement: "admin.rbac.modules.emplacement",
  stock: "admin.rbac.modules.stock",
  reservation: "admin.rbac.modules.reservation",
  mouvement: "admin.rbac.modules.mouvement",
  caisse: "admin.rbac.modules.caisse",
  livre_quittance: "admin.rbac.modules.livre_quittance",
  quittance: "admin.rbac.modules.quittance",
  reglement: "admin.rbac.modules.reglement",
  livre_caisse: "admin.rbac.modules.livre_caisse",
  recouvrement: "admin.rbac.modules.recouvrement",
  audit: "admin.rbac.modules.audit",
};

const ACTIONS: Record<string, string> = {
  view: "admin.rbac.actions.view",
  create: "admin.rbac.actions.create",
  update: "admin.rbac.actions.update",
  delete: "admin.rbac.actions.delete",
  valider: "admin.rbac.actions.valider",
  transfer: "admin.rbac.actions.transfer",
  encaisser: "admin.rbac.actions.encaisser",
  virement: "admin.rbac.actions.virement",
};

export const moduleDe = (code: string) => code.split(".")[0];
export const actionDe = (code: string) => code.split(".").slice(1).join(".");
export const libelleModule = (code: string) => MODULES[moduleDe(code)] ?? moduleDe(code);
export const libelleAction = (code: string) => ACTIONS[actionDe(code)] ?? actionDe(code);

export interface GroupePrivileges {
  module: string;
  label: string;
  items: Privilege[];
}

/** Regroupe par module (ordre alphabétique) ; dans chaque module, view / create / update / delete d'abord. */
export function grouperPrivileges(privileges: Privilege[]): GroupePrivileges[] {
  const ordre = ["view", "create", "update", "delete"];
  const rang = (code: string) => {
    const i = ordre.indexOf(actionDe(code));
    return i === -1 ? ordre.length : i;
  };
  const map = new Map<string, Privilege[]>();
  for (const p of privileges) {
    const m = moduleDe(p.code_action);
    map.set(m, [...(map.get(m) ?? []), p]);
  }
  return [...map.entries()]
    .map(([module, items]) => ({
      module,
      label: MODULES[module] ?? module,
      items: [...items].sort(
        (a, b) => rang(a.code_action) - rang(b.code_action) || a.code_action.localeCompare(b.code_action),
      ),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "fr"));
}