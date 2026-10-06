import type { Privilege } from "@/types/users";

/** Libellés français des modules (préfixe d'un code « module.action »). */
const MODULES: Record<string, string> = {
  utilisateur: "Utilisateurs", role: "Rôles", privilege: "Privilèges",
  province: "Provinces", region: "Régions", district: "Districts",
  commune: "Communes", fokontany: "Fokontany",
  client: "Clients", organisme: "Organismes", solvabilite: "Solvabilité",
  type_financement: "Types de financement", budget: "Budgets",
  ligne_budgetaire: "Lignes budgétaires", prevision: "Prévisions budgétaires",
  engagement: "Engagements",
  categorie: "Catégories de produits", produit: "Produits",
  config_serie: "Configurations de série", lot: "Lots de production",
  planification: "Planifications", devis: "Devis", commande: "Commandes",
  preparation: "Préparations", livraison: "Livraisons", facture: "Factures", avoir: "Avoirs",
  magasin: "Magasins", emplacement: "Emplacements", stock: "Niveaux de stock",
  reservation: "Réservations", mouvement: "Mouvements de stock",
  caisse: "Caisses", livre_quittance: "Carnets de quittances", quittance: "Quittances",
  reglement: "Règlements", livre_caisse: "Livre de caisse",
  recouvrement: "Recouvrement", audit: "Journal d'audit",
};

const ACTIONS: Record<string, string> = {
  view: "Consulter", create: "Créer", update: "Modifier", delete: "Supprimer",
  valider: "Valider", transfer: "Transférer", encaisser: "Encaisser", virement: "Virements",
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