import {
  AlertTriangle, Banknote, ClipboardList, Factory, FileText, Gauge, KeyRound, Landmark,
  Package, PackageCheck, Receipt, ScrollText, ShieldCheck, ShoppingCart, Store, Truck,
  Undo2, UserCog, Users, Wallet, Warehouse, BarChart3,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/data/status-badge";
import { aujourdhui, anneeCourante } from "@/lib/dates";
import { formatAr, formatDateTime } from "@/lib/format";
import type { Facture, Preparation, LigneFacture, LignePreparation } from "@/types/commercial";
import { queue, type RoleDashboardDef } from "./types";

// -------------------------------------------------- Types des lignes de files
interface CommandeRow { id_commande: number; num_commande: string; nom_client: string; total: string; statut_commande: string }
interface LotRow { id_lot: number; num_lot: string; designation: string; num_debut: number; num_fin: number; statut_prod: string }
interface ImpayeRow { facture: number; num_facture: string; nom_client: string; jours_retard: number; montant_du: number }
interface AuditRow { id_audit: number; date_audit: string; identifiant_utilisateur: string; operation: string; table_nom: string; reference: string | null }

// ------------------------------------------------------------ Files réutilisées
const factureRow = (f: Facture, t: (c: string, p?: Record<string, string | number>) => string) => ({
  titre: f.num_facture,
  detail: `${f.nom_client} · ${formatAr(f.reste_a_payer)} ${t("dash.file.reste")}`,
  badge: <StatusBadge statut={f.statut_paiement} />,
  href: `/commercial/factures/${f.id_facture}`,
});

const preparationRow = (p: Preparation, _t: (c: string) => string) => ({
  titre: p.num_commande,
  detail: `${p.nom_client} · ${(p.lignes ?? []).map((l: LignePreparation) => `${l.quantite_preparee} × ${l.code_produit}`).join(", ")}`,
  badge: <StatusBadge statut={p.statut_prepa} />,
  href: "/commercial/preparations",
});

const commandeRow = (c: CommandeRow, _t: (c: string) => string) => ({
  titre: c.num_commande,
  detail: `${c.nom_client} · ${formatAr(c.total)}`,
  badge: <StatusBadge statut={c.statut_commande} />,
  href: `/commercial/commandes/${c.id_commande}`,
});

const lotRow = (l: LotRow, _t: (c: string) => string) => ({
  titre: l.num_lot,
  detail: `${l.designation} · n° ${l.num_debut} – ${l.num_fin}`,
  badge: <StatusBadge statut={l.statut_prod} />,
  href: "/produits/lots",
});

// ------------------------------------------------------------------- Rôles
const RECEPTION: RoleDashboardDef = {
  role: "RECEPTION",
  titre: "dash.roles.reception.titre",
  description: "dash.roles.reception.description",
  kpis: [],
  actions: [
    { label: "dash.action.vente_comptoir", description: "dash.action.vente_comptoir_desc", href: "/comptoir", icon: Store, privilege: "client_simple.create" },
    { label: "dash.action.stock_dispo", description: "dash.action.stock_dispo_desc", href: "/stock", icon: Warehouse, privilege: "stock.view" },
  ],
  queues: [],
};

const COMMERCIAL: RoleDashboardDef = {
  role: "COMMERCIAL",
  titre: "dash.roles.commercial.titre",
  description: "dash.roles.commercial.description",
  kpis: [
    { key: "brouillon", label: "dash.kpi.brouillon", path: "commercial/commandes", params: () => ({ statut: "BROUILLON" }), privilege: "commande.view", href: "/commercial/commandes", ton: "attention" },
    { key: "validees", label: "dash.kpi.validees", path: "commercial/commandes", params: () => ({ statut: "VALIDEE" }), privilege: "commande.view", href: "/commercial/commandes" },
    { key: "devis", label: "dash.kpi.devis_annee", path: "commercial/devis", params: () => ({ annee: anneeCourante() }), privilege: "devis.view", href: "/commercial/devis" },
    { key: "engagements", label: "dash.kpi.engagements", path: "budget/engagements", params: () => ({ statut: "VISE" }), privilege: "engagement.view", href: "/budget/engagements" },
    { key: "clients", label: "dash.kpi.clients", path: "clients/clients", privilege: "client.view", href: "/clients" },
    { key: "bloques", label: "dash.kpi.bloques_prives", path: "clients/solvabilites", params: () => ({ statut_blocage: "1" }), privilege: "solvabilite.view", href: "/clients/solvabilites", ton: "danger" },
  ],
  actions: [
    { label: "dash.action.nouveau_devis", description: "dash.action.nouveau_devis_desc", href: "/commercial/devis", icon: FileText, privilege: "devis.create" },
    { label: "dash.action.nouvelle_commande", description: "dash.action.nouvelle_commande_desc", href: "/commercial/commandes", icon: ShoppingCart, privilege: "commande.create" },
    { label: "dash.action.nouveau_client", description: "dash.action.nouveau_client_desc", href: "/clients", icon: Users, privilege: "client.create" },
    { label: "dash.action.planification", description: "dash.action.planification_desc", href: "/commercial/planifications", icon: ClipboardList, privilege: "planification.view" },
  ],
  queues: [
    queue<CommandeRow>({
      title: "dash.file.commandes_valider", path: "commercial/commandes",
      params: () => ({ statut: "BROUILLON" }), privilege: "commande.view", href: "/commercial/commandes",
      empty: "dash.file.vide_brouillon", row: commandeRow,
    }),
  ],
};

const MAGASINIER: RoleDashboardDef = {
  role: "MAGASINIER",
  titre: "dash.roles.magasinier.titre",
  description: "dash.roles.magasinier.description",
  kpis: [
    { key: "a-preparer", label: "dash.kpi.a_preparer", path: "commercial/commandes", params: () => ({ statut: "VALIDEE" }), privilege: "commande.view", href: "/commercial/preparations", ton: "attention", live: true },
    { key: "en-cours", label: "dash.kpi.preparations", path: "commercial/preparations", params: () => ({ statut: "EN_COURS" }), privilege: "preparation.view", href: "/commercial/preparations", live: true },
    { key: "pretes", label: "dash.kpi.pretes", path: "commercial/preparations", params: () => ({ statut: "PRETE" }), privilege: "preparation.view", href: "/commercial/livraisons", ton: "attention", live: true },
    { key: "comptoir", label: "dash.kpi.comptoir", path: "commercial/factures", params: () => ({ a_livrer: "true" }), privilege: "facture.view", href: "/commercial/livraisons", ton: "attention", live: true },
    { key: "resa", label: "dash.kpi.resa", path: "stock/reservations", privilege: "reservation.view", href: "/stock/reservations" },
  ],
  actions: [
    { label: "dash.action.livrer", description: "dash.action.livrer_desc", href: "/commercial/livraisons", icon: Truck, privilege: "livraison.create" },
    { label: "dash.action.preparations", description: "dash.action.preparations_desc", href: "/commercial/preparations", icon: PackageCheck, privilege: "preparation.view" },
    { label: "dash.action.niveaux_stock", description: "dash.action.niveaux_stock_desc", href: "/stock", icon: Warehouse, privilege: "stock.view" },
    { label: "dash.action.remettre_stock", description: "dash.action.remettre_stock_desc", href: "/commercial/avoirs", icon: Undo2, privilege: "avoir.view" },
  ],
  queues: [
    queue<Facture>({
      title: "dash.file.ventes_livrer", path: "commercial/factures",
      params: () => ({ a_livrer: "true", ordering: "date_facture" }),
      privilege: "livraison.create", href: "/commercial/livraisons", live: true,
      empty: "dash.file.vide_livraison",
      row: (f) => ({ ...factureRow(f, (c) => c), detail: `${f.nom_client} · ${(f.lignes ?? []).map((l: LigneFacture) => `${l.quantite_facturee} × ${l.code_produit}`).join(", ")}` }),
    }),
    queue<Preparation>({
      title: "dash.file.prepa_cours", path: "commercial/preparations",
      params: () => ({ statut: "EN_COURS" }), privilege: "preparation.view", href: "/commercial/preparations", live: true,
      empty: "dash.file.vide_prepa", row: preparationRow,
    }),
  ],
};

const CAISSIER: RoleDashboardDef = {
  role: "CAISSIER",
  titre: "dash.roles.caissier.titre",
  description: "dash.roles.caissier.description",
  kpis: [
    { key: "a-encaisser", label: "dash.kpi.a_encaisser", path: "commercial/factures", params: () => ({ type_facturation: "QUITTANCE", statut: "NON_PAYEE" }), privilege: "facture.view", href: "/commercial/factures", ton: "attention", live: true },
    { key: "partielles", label: "dash.kpi.partielles", path: "commercial/factures", params: () => ({ type_facturation: "QUITTANCE", statut: "PARTIELLE" }), privilege: "facture.view", href: "/commercial/factures", live: true },
    { key: "jour", label: "dash.kpi.jour", path: "tresorerie/reglements", params: () => ({ du: aujourdhui(), au: aujourdhui() }), privilege: "reglement.view", href: "/tresorerie/reglements", ton: "succes", live: true },
    { key: "solde", label: "dash.kpi.solde", path: "tresorerie/caisses", agg: { type: "sum", field: "solde_actuel" }, format: "ar", privilege: "caisse.view", href: "/tresorerie/caisses" },
  ],
  actions: [
    { label: "dash.action.encaisser", description: "dash.action.encaisser_desc", href: "/tresorerie/reglements", icon: Banknote, privilege: "reglement.encaisser" },
    { label: "dash.action.mes_caisses", description: "dash.action.mes_caisses_desc", href: "/tresorerie/caisses", icon: Landmark, privilege: "caisse.view" },
    { label: "dash.action.factures", description: "dash.action.factures_desc", href: "/commercial/factures", icon: Receipt, privilege: "facture.view" },
    { label: "dash.action.quittances", description: "dash.action.quittances_desc", href: "/tresorerie/quittances", icon: ScrollText, privilege: "quittance.view" },
  ],
  queues: [
    queue<Facture>({
      title: "dash.file.file_encaissement", path: "commercial/factures",
      params: () => ({ type_facturation: "QUITTANCE", statut: "NON_PAYEE", ordering: "date_facture" }),
      privilege: "facture.view", href: "/commercial/factures", live: true,
      empty: "dash.file.vide_encaissement",
      row: (f, t) => ({ ...factureRow(f, t), detail: `${f.nom_client} · ${formatAr(f.reste_a_payer)} ${t("dash.file.reste")} · ${formatDateTime(f.date_facture)}` }),
    }),
    queue<Facture>({
      title: "dash.file.partiels", path: "commercial/factures",
      params: () => ({ type_facturation: "QUITTANCE", statut: "PARTIELLE" }),
      privilege: "facture.view", href: "/commercial/factures", live: true,
      empty: "dash.file.vide_partiels", row: factureRow,
    }),
  ],
};

const COMPTABLE: RoleDashboardDef = {
  role: "COMPTABLE",
  titre: "dash.roles.comptable.titre",
  description: "dash.roles.comptable.description",
  kpis: [
    { key: "virements", label: "dash.kpi.virements", path: "commercial/factures", params: () => ({ type_facturation: "VIREMENT_TRESOR", statut: "NON_PAYEE" }), privilege: "facture.view", href: "/commercial/factures", ton: "attention", live: true },
    { key: "a-facturer", label: "dash.kpi.a_facturer", path: "commercial/commandes", params: () => ({ statuts: "VALIDEE,EN_PREPARATION,LIVREE" }), privilege: "commande.view", href: "/commercial/factures", ton: "attention" },
    { key: "partielles", label: "dash.kpi.partiels", path: "commercial/factures", params: () => ({ statut: "PARTIELLE" }), privilege: "facture.view", href: "/commercial/factures" },
    { key: "engagements", label: "dash.kpi.engagements", path: "budget/engagements", params: () => ({ statut: "VISE" }), privilege: "engagement.view", href: "/budget/engagements" },
    { key: "bloques", label: "dash.kpi.bloques_prives", path: "clients/solvabilites", params: () => ({ statut_blocage: "1" }), privilege: "solvabilite.view", href: "/clients/solvabilites", ton: "danger" },
    { key: "dossiers", label: "dash.kpi.dossiers", path: "recouvrement/dossiers", params: () => ({ statut: "EN_COURS" }), privilege: "recouvrement.view", href: "/recouvrement" },
  ],
  actions: [
    { label: "dash.action.facturer", description: "dash.action.facturer_desc", href: "/commercial/factures", icon: Receipt, privilege: "facture.create" },
    { label: "dash.action.virement", description: "dash.action.virement_desc", href: "/tresorerie/reglements", icon: Banknote, privilege: "reglement.virement" },
    { label: "dash.action.budgets", description: "dash.action.budgets_desc", href: "/budget/budgets", icon: Wallet, privilege: "budget.view" },
    { label: "dash.action.solvabilite", description: "dash.action.solvabilite_desc", href: "/clients/solvabilites", icon: Gauge, privilege: "solvabilite.view" },
    { label: "dash.action.stats", description: "dash.action.stats_desc", href: "/statistiques", icon: BarChart3, privilege: "statistiques.view" },
  ],
  queues: [
    queue<Facture>({
      title: "dash.file.virements", path: "commercial/factures",
      params: () => ({ type_facturation: "VIREMENT_TRESOR", statut: "NON_PAYEE", ordering: "date_facture" }),
      privilege: "facture.view", href: "/commercial/factures", live: true,
      empty: "dash.file.vide_virements", row: factureRow,
    }),
    queue<CommandeRow>({
      title: "dash.file.a_facturer", path: "commercial/commandes",
      params: () => ({ statuts: "VALIDEE,EN_PREPARATION,LIVREE" }), privilege: "commande.view", href: "/commercial/factures",
      empty: "dash.file.vide_facturation", row: commandeRow,
    }),
  ],
};

const RECOUVREMENT: RoleDashboardDef = {
  role: "RECOUVREMENT",
  titre: "dash.roles.recouvrement.titre",
  description: "dash.roles.recouvrement.description",
  kpis: [
    { key: "echus", label: "dash.kpi.echus", path: "recouvrement/dossiers/impayes", agg: { type: "length" }, privilege: "recouvrement.view", href: "/recouvrement", ton: "danger" },
    { key: "montant", label: "dash.kpi.montant", path: "recouvrement/dossiers/impayes", agg: { type: "sumArray", field: "montant_du" }, format: "ar", privilege: "recouvrement.view", href: "/recouvrement", ton: "danger" },
    { key: "en-cours", label: "dash.kpi.dossiers_cours", path: "recouvrement/dossiers", params: () => ({ statut: "EN_COURS" }), privilege: "recouvrement.view", href: "/recouvrement", ton: "attention" },
    { key: "contentieux", label: "dash.kpi.contentieux", path: "recouvrement/dossiers", params: () => ({ statut: "CONTENTIEUX" }), privilege: "recouvrement.view", href: "/recouvrement", ton: "danger" },
    { key: "bloques", label: "dash.kpi.bloques", path: "clients/solvabilites", params: () => ({ statut_blocage: "1" }), privilege: "solvabilite.view", href: "/clients/solvabilites" },
  ],
  actions: [
    { label: "dash.action.ouvrir_dossier", description: "dash.action.ouvrir_dossier_desc", href: "/recouvrement", icon: AlertTriangle, privilege: "recouvrement.create" },
    { label: "dash.action.factures", description: "dash.action.factures_reste", href: "/commercial/factures", icon: Receipt, privilege: "facture.view" },
    { label: "dash.action.reglements", description: "dash.action.reglements_desc", href: "/tresorerie/reglements", icon: Banknote, privilege: "reglement.view" },
    { label: "dash.action.clients", description: "dash.action.clients_desc", href: "/clients", icon: Users, privilege: "client.view" },
  ],
  queues: [
    queue<ImpayeRow>({
      title: "dash.file.impayes", path: "recouvrement/dossiers/impayes", array: true,
      privilege: "recouvrement.view", href: "/recouvrement", empty: "dash.file.vide_impayes",
      row: (i, t) => ({
        titre: i.num_facture,
        detail: `${i.nom_client} · ${t("dash.file.retard", { n: i.jours_retard })}`,
        badge: <Badge variant="destructive">{formatAr(i.montant_du)}</Badge>,
        href: `/commercial/factures/${i.facture}`,
      }),
    }),
  ],
};

const PRODUCTION: RoleDashboardDef = {
  role: "PRODUCTION",
  titre: "dash.roles.production.titre",
  description: "dash.roles.production.description",
  kpis: [
    { key: "planifies", label: "dash.kpi.planifies", path: "produits/lots", params: () => ({ statut: "PLANIFIE" }), privilege: "lot.view", href: "/produits/lots", ton: "attention", live: true },
    { key: "en-cours", label: "dash.kpi.lots_cours", path: "produits/lots", params: () => ({ statut: "EN_COURS" }), privilege: "lot.view", href: "/produits/lots", live: true },
    { key: "preparations", label: "dash.kpi.preparations", path: "commercial/preparations", params: () => ({ statut: "EN_COURS" }), privilege: "preparation.view", href: "/commercial/preparations" },
    { key: "produits", label: "dash.kpi.produits", path: "produits", params: () => ({ en_serie: "true" }), privilege: "produit.view", href: "/produits" },
  ],
  actions: [
    { label: "dash.action.lancer_lot", description: "dash.action.lancer_lot_desc", href: "/produits/lots", icon: Factory, privilege: "lot.create" },
    { label: "dash.action.produits", description: "dash.action.produits_desc", href: "/produits", icon: Package, privilege: "produit.view" },
    { label: "dash.action.preparations", description: "dash.action.prepa_lots", href: "/commercial/preparations", icon: PackageCheck, privilege: "preparation.view" },
  ],
  queues: [
    queue<LotRow>({
      title: "dash.file.lots_cours", path: "produits/lots",
      params: () => ({ statut: "EN_COURS" }), privilege: "lot.view", href: "/produits/lots", live: true,
      empty: "dash.file.vide_lots_cours", row: lotRow,
    }),
    queue<LotRow>({
      title: "dash.file.lots_planifies", path: "produits/lots",
      params: () => ({ statut: "PLANIFIE" }), privilege: "lot.view", href: "/produits/lots", live: true,
      empty: "dash.file.vide_lots_planifies", row: lotRow,
    }),
  ],
};

const DIRECTION: RoleDashboardDef = {
  role: "DIRECTION",
  titre: "dash.roles.direction.titre",
  description: "dash.roles.direction.description",
  kpis: [
    { key: "commandes", label: "dash.kpi.validees", path: "commercial/commandes", params: () => ({ statut: "VALIDEE" }), privilege: "commande.view", href: "/commercial/commandes" },
    { key: "non-payees", label: "dash.kpi.non_payees", path: "commercial/factures", params: () => ({ statut: "NON_PAYEE" }), privilege: "facture.view", href: "/commercial/factures", ton: "attention" },
    { key: "contentieux", label: "dash.kpi.contentieux", path: "recouvrement/dossiers", params: () => ({ statut: "CONTENTIEUX" }), privilege: "recouvrement.view", href: "/recouvrement", ton: "danger" },
    { key: "engagements", label: "dash.kpi.engagements", path: "budget/engagements", params: () => ({ statut: "VISE" }), privilege: "engagement.view", href: "/budget/engagements" },
    { key: "bloques", label: "dash.kpi.bloques_prives", path: "clients/solvabilites", params: () => ({ statut_blocage: "1" }), privilege: "solvabilite.view", href: "/clients/solvabilites", ton: "danger" },
    { key: "lots", label: "dash.kpi.lots", path: "produits/lots", params: () => ({ statut: "EN_COURS" }), privilege: "lot.view", href: "/produits/lots" },
    { key: "caisses", label: "dash.kpi.solde", path: "tresorerie/caisses", agg: { type: "sum", field: "solde_actuel" }, format: "ar", privilege: "caisse.view", href: "/tresorerie/caisses" },
  ],
  actions: [
    { label: "dash.action.clients", description: "dash.action.clients_tous", href: "/clients", icon: Users, privilege: ["client.view", "client_simple.view"] },
    { label: "dash.action.factures", description: "dash.action.impayes_factures", href: "/commercial/factures", icon: Receipt, privilege: "facture.view" },
    { label: "dash.action.budgets", description: "dash.action.budgets_desc", href: "/budget/budgets", icon: Wallet, privilege: "budget.view" },
    { label: "dash.action.journal", description: "dash.action.journal_desc", href: "/audit", icon: ShieldCheck, privilege: "audit.view" },
    { label: "dash.action.stats", description: "dash.action.stats_desc", href: "/statistiques", icon: BarChart3, privilege: "statistiques.view" },
  ],
  queues: [
    queue<Facture>({
      title: "dash.file.factures_recentes", path: "commercial/factures",
      params: () => ({ statut: "NON_PAYEE", ordering: "-date_facture" }),
      privilege: "facture.view", href: "/commercial/factures", empty: "dash.file.vide_impayees", row: factureRow,
    }),
  ],
};

const ADMIN: RoleDashboardDef = {
  role: "ADMIN",
  titre: "dash.roles.admin.titre",
  description: "dash.roles.admin.description",
  kpis: [
    { key: "actifs", label: "dash.kpi.actifs", path: "users/utilisateurs", params: () => ({ statut: "ACTIF" }), privilege: "utilisateur.view", href: "/admin/utilisateurs", ton: "succes" },
    { key: "inactifs", label: "dash.kpi.inactifs", path: "users/utilisateurs", params: () => ({ statut: "INACTIF" }), privilege: "utilisateur.view", href: "/admin/utilisateurs" },
    { key: "suspendus", label: "dash.kpi.suspendus", path: "users/utilisateurs", params: () => ({ statut: "SUSPENDU" }), privilege: "utilisateur.view", href: "/admin/utilisateurs", ton: "attention" },
    { key: "roles", label: "dash.kpi.roles", path: "users/roles", privilege: "role.view", href: "/admin/roles" },
    { key: "audit", label: "dash.kpi.audit", path: "audit/journal", params: () => ({ du: aujourdhui(), au: aujourdhui() }), privilege: "audit.view", href: "/audit" },
  ],
  actions: [
    { label: "dash.action.utilisateurs", description: "dash.action.utilisateurs_desc", href: "/admin/utilisateurs", icon: UserCog, privilege: "utilisateur.view" },
    { label: "dash.action.roles_priv", description: "dash.action.roles_priv_desc", href: "/admin/roles", icon: KeyRound, privilege: "role.view" },
    { label: "dash.action.journal", description: "dash.action.journal_desc", href: "/audit", icon: ShieldCheck, privilege: "audit.view" },
    { label: "dash.action.clients", description: "dash.action.clients_tous", href: "/clients", icon: Users, privilege: ["client.view", "client_simple.view"] },
  ],
  queues: [
    queue<AuditRow>({
      title: "dash.file.audit", path: "audit/journal", limit: 8,
      privilege: "audit.view", href: "/audit", empty: "dash.file.vide_audit",
      row: (a) => ({
        titre: `${a.operation} · ${a.table_nom}${a.reference ? ` · ${a.reference}` : ""}`,
        detail: `${a.identifiant_utilisateur} · ${formatDateTime(a.date_audit)}`,
        href: "/audit",
      }),
    }),
  ],
};

export const DASHBOARDS: Record<string, RoleDashboardDef> = {
  ADMIN, DIRECTION, COMMERCIAL, RECEPTION, MAGASINIER, PRODUCTION, CAISSIER, COMPTABLE, RECOUVREMENT,
};

/** Ordre de priorité quand un utilisateur cumule plusieurs rôles. */
export const ORDRE_ROLES = [
  "ADMIN", "DIRECTION", "COMMERCIAL", "RECEPTION", "MAGASINIER",
  "PRODUCTION", "CAISSIER", "COMPTABLE", "RECOUVREMENT",
];