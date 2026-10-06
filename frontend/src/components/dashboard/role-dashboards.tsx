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
const factureRow = (f: Facture) => ({
  titre: f.num_facture,
  detail: `${f.nom_client} · ${formatAr(f.reste_a_payer)} restant`,
  badge: <StatusBadge statut={f.statut_paiement} />,
  href: `/commercial/factures/${f.id_facture}`,
});

const preparationRow = (p: Preparation) => ({
  titre: p.num_commande,
  detail: `${p.nom_client} · ${(p.lignes ?? []).map((l: LignePreparation) => `${l.quantite_preparee} × ${l.code_produit}`).join(", ")}`,
  badge: <StatusBadge statut={p.statut_prepa} />,
  href: "/commercial/preparations",
});

const commandeRow = (c: CommandeRow) => ({
  titre: c.num_commande,
  detail: `${c.nom_client} · ${formatAr(c.total)}`,
  badge: <StatusBadge statut={c.statut_commande} />,
  href: `/commercial/commandes/${c.id_commande}`,
});

const lotRow = (l: LotRow) => ({
  titre: l.num_lot,
  detail: `${l.designation} · n° ${l.num_debut} – ${l.num_fin}`,
  badge: <StatusBadge statut={l.statut_prod} />,
  href: "/produits/lots",
});

// ------------------------------------------------------------------- Rôles
const RECEPTION: RoleDashboardDef = {
  role: "RECEPTION",
  titre: "Réception",
  description: "Accueil des clients du comptoir : vente directe, facture transmise au caissier.",
  kpis: [
    { key: "a-encaisser", label: "Ventes à encaisser", path: "commercial/factures", params: () => ({ comptoir: "true", statut: "NON_PAYEE" }), privilege: "facture.view", href: "/commercial/factures", ton: "attention", live: true },
    { key: "a-livrer", label: "Payées, à livrer", path: "commercial/factures", params: () => ({ a_livrer: "true" }), privilege: "facture.view", href: "/commercial/factures", live: true },
    { key: "clients", label: "Clients du comptoir", path: "clients/clients", params: () => ({ type_client: "SIMPLE" }), privilege: "client_simple.view", href: "/clients" },
  ],
  actions: [
    { label: "Nouvelle vente", description: "Client, produits, facture", href: "/comptoir", icon: Store, privilege: "client_simple.create" },
    { label: "Clients du comptoir", description: "Rechercher ou créer un client", href: "/clients", icon: Users, privilege: ["client_simple.view"] },
    { label: "Factures", description: "Suivi des paiements", href: "/commercial/factures", icon: Receipt, privilege: "facture.view" },
    { label: "Stock disponible", description: "Vérifier avant de vendre", href: "/stock", icon: Warehouse, privilege: "stock.view" },
  ],
  queues: [
    queue<Facture>({
      title: "Ventes en attente d'encaissement", path: "commercial/factures",
      params: () => ({ comptoir: "true", statut: "NON_PAYEE", ordering: "-date_facture" }),
      privilege: "facture.view", href: "/commercial/factures", live: true,
      empty: "Aucune vente en attente.", row: factureRow,
    }),
  ],
};

const COMMERCIAL: RoleDashboardDef = {
  role: "COMMERCIAL",
  titre: "Commercial",
  description: "Ministères, collectivités et clients privés : devis, commandes et suivi des engagements.",
  kpis: [
    { key: "brouillon", label: "Commandes brouillon", path: "commercial/commandes", params: () => ({ statut: "BROUILLON" }), privilege: "commande.view", href: "/commercial/commandes", ton: "attention" },
    { key: "validees", label: "Commandes validées", path: "commercial/commandes", params: () => ({ statut: "VALIDEE" }), privilege: "commande.view", href: "/commercial/commandes" },
    { key: "devis", label: "Devis de l'année", path: "commercial/devis", params: () => ({ annee: anneeCourante() }), privilege: "devis.view", href: "/commercial/devis" },
    { key: "engagements", label: "Engagements visés", path: "budget/engagements", params: () => ({ statut: "VISE" }), privilege: "engagement.view", href: "/budget/engagements" },
    { key: "clients", label: "Clients suivis", path: "clients/clients", privilege: "client.view", href: "/clients" },
    { key: "bloques", label: "Clients privés bloqués", path: "clients/solvabilites", params: () => ({ statut_blocage: "1" }), privilege: "solvabilite.view", href: "/clients/solvabilites", ton: "danger" },
  ],
  actions: [
    { label: "Nouveau devis", description: "Proforma pour un client", href: "/commercial/devis", icon: FileText, privilege: "devis.create" },
    { label: "Nouvelle commande", description: "Depuis un devis ou en direct", href: "/commercial/commandes", icon: ShoppingCart, privilege: "commande.create" },
    { label: "Nouveau client", description: "SOA ou client privé", href: "/clients", icon: Users, privilege: "client.create" },
    { label: "Planification", description: "Besoins prévus des clients", href: "/commercial/planifications", icon: ClipboardList, privilege: "planification.view" },
  ],
  queues: [
    queue<CommandeRow>({
      title: "Commandes à valider", path: "commercial/commandes",
      params: () => ({ statut: "BROUILLON" }), privilege: "commande.view", href: "/commercial/commandes",
      empty: "Aucune commande en brouillon.", row: commandeRow,
    }),
  ],
};

const MAGASINIER: RoleDashboardDef = {
  role: "MAGASINIER",
  titre: "Magasin",
  description: "Préparation des commandes, réservation du stock et livraisons.",
  kpis: [
    { key: "a-preparer", label: "Commandes à préparer", path: "commercial/commandes", params: () => ({ statut: "VALIDEE" }), privilege: "commande.view", href: "/commercial/preparations", ton: "attention", live: true },
    { key: "en-cours", label: "Préparations en cours", path: "commercial/preparations", params: () => ({ statut: "EN_COURS" }), privilege: "preparation.view", href: "/commercial/preparations", live: true },
    { key: "pretes", label: "Prêtes à livrer", path: "commercial/preparations", params: () => ({ statut: "PRETE" }), privilege: "preparation.view", href: "/commercial/livraisons", ton: "attention", live: true },
    { key: "comptoir", label: "Ventes comptoir à livrer", path: "commercial/factures", params: () => ({ a_livrer: "true" }), privilege: "facture.view", href: "/commercial/livraisons", ton: "attention", live: true },
    { key: "resa", label: "Réservations actives", path: "stock/reservations", privilege: "reservation.view", href: "/stock/reservations" },
  ],
  actions: [
    { label: "Livrer", description: "Comptoir et commandes prêtes", href: "/commercial/livraisons", icon: Truck, privilege: "livraison.create" },
    { label: "Préparations", description: "Réserver, terminer", href: "/commercial/preparations", icon: PackageCheck, privilege: "preparation.view" },
    { label: "Niveaux de stock", description: "Disponible et réservé", href: "/stock", icon: Warehouse, privilege: "stock.view" },
    { label: "Remettre en stock", description: "Retours sur avoirs", href: "/commercial/avoirs", icon: Undo2, privilege: "avoir.view" },
  ],
  queues: [
    queue<Facture>({
      title: "Ventes comptoir payées, à livrer", path: "commercial/factures",
      params: () => ({ a_livrer: "true", ordering: "date_facture" }),
      privilege: "livraison.create", href: "/commercial/livraisons", live: true,
      empty: "Aucune vente en attente de livraison.",
      row: (f) => ({ ...factureRow(f), detail: `${f.nom_client} · ${(f.lignes ?? []).map((l: LigneFacture) => `${l.quantite_facturee} × ${l.code_produit}`).join(", ")}` }),
    }),
    queue<Preparation>({
      title: "Préparations en cours", path: "commercial/preparations",
      params: () => ({ statut: "EN_COURS" }), privilege: "preparation.view", href: "/commercial/preparations", live: true,
      empty: "Aucune préparation en cours.", row: preparationRow,
    }),
  ],
};

const CAISSIER: RoleDashboardDef = {
  role: "CAISSIER",
  titre: "Caisse",
  description: "Encaissement des factures et suivi des caisses.",
  kpis: [
    { key: "a-encaisser", label: "Factures à encaisser", path: "commercial/factures", params: () => ({ type_facturation: "QUITTANCE", statut: "NON_PAYEE" }), privilege: "facture.view", href: "/commercial/factures", ton: "attention", live: true },
    { key: "partielles", label: "Paiements partiels", path: "commercial/factures", params: () => ({ type_facturation: "QUITTANCE", statut: "PARTIELLE" }), privilege: "facture.view", href: "/commercial/factures", live: true },
    { key: "jour", label: "Encaissements du jour", path: "tresorerie/reglements", params: () => ({ du: aujourdhui(), au: aujourdhui() }), privilege: "reglement.view", href: "/tresorerie/reglements", ton: "succes", live: true },
    { key: "solde", label: "Solde des caisses", path: "tresorerie/caisses", agg: { type: "sum", field: "solde_actuel" }, format: "ar", privilege: "caisse.view", href: "/tresorerie/caisses" },
  ],
  actions: [
    { label: "Encaisser", description: "Règlement et quittance", href: "/tresorerie/reglements", icon: Banknote, privilege: "reglement.encaisser" },
    { label: "Mes caisses", description: "Soldes et livre de caisse", href: "/tresorerie/caisses", icon: Landmark, privilege: "caisse.view" },
    { label: "Factures", description: "Suivi des paiements", href: "/commercial/factures", icon: Receipt, privilege: "facture.view" },
    { label: "Quittances", description: "Carnets et volets utilisés", href: "/tresorerie/quittances", icon: ScrollText, privilege: "quittance.view" },
  ],
  queues: [
    queue<Facture>({
      title: "File d'encaissement", path: "commercial/factures",
      params: () => ({ type_facturation: "QUITTANCE", statut: "NON_PAYEE", ordering: "date_facture" }),
      privilege: "facture.view", href: "/commercial/factures", live: true,
      empty: "Aucune facture à encaisser.",
      row: (f) => ({ ...factureRow(f), detail: `${f.nom_client} · ${formatAr(f.reste_a_payer)} à payer · ${formatDateTime(f.date_facture)}` }),
    }),
    queue<Facture>({
      title: "Paiements partiels à compléter", path: "commercial/factures",
      params: () => ({ type_facturation: "QUITTANCE", statut: "PARTIELLE" }),
      privilege: "facture.view", href: "/commercial/factures", live: true,
      empty: "Aucun paiement partiel.", row: factureRow,
    }),
  ],
};

const COMPTABLE: RoleDashboardDef = {
  role: "COMPTABLE",
  titre: "Comptabilité",
  description: "Facturation, virements du Trésor, engagements et suivi des impayés.",
  kpis: [
    { key: "virements", label: "Virements du Trésor attendus", path: "commercial/factures", params: () => ({ type_facturation: "VIREMENT_TRESOR", statut: "NON_PAYEE" }), privilege: "facture.view", href: "/commercial/factures", ton: "attention", live: true },
    { key: "a-facturer", label: "Commandes livrées à facturer", path: "commercial/commandes", params: () => ({ statut: "LIVREE" }), privilege: "commande.view", href: "/commercial/factures", ton: "attention" },
    { key: "partielles", label: "Factures partiellement payées", path: "commercial/factures", params: () => ({ statut: "PARTIELLE" }), privilege: "facture.view", href: "/commercial/factures" },
    { key: "engagements", label: "Engagements visés", path: "budget/engagements", params: () => ({ statut: "VISE" }), privilege: "engagement.view", href: "/budget/engagements" },
    { key: "bloques", label: "Clients privés bloqués", path: "clients/solvabilites", params: () => ({ statut_blocage: "1" }), privilege: "solvabilite.view", href: "/clients/solvabilites", ton: "danger" },
    { key: "dossiers", label: "Dossiers de recouvrement", path: "recouvrement/dossiers", params: () => ({ statut: "EN_COURS" }), privilege: "recouvrement.view", href: "/recouvrement" },
  ],
  actions: [
    { label: "Facturer une commande", description: "Commandes livrées", href: "/commercial/factures", icon: Receipt, privilege: "facture.create" },
    { label: "Enregistrer un virement", description: "Avis du Trésor", href: "/tresorerie/reglements", icon: Banknote, privilege: "reglement.virement" },
    { label: "Budgets", description: "Lignes et engagements", href: "/budget/budgets", icon: Wallet, privilege: "budget.view" },
    { label: "Solvabilité", description: "Plafonds et blocages", href: "/clients/solvabilites", icon: Gauge, privilege: "solvabilite.view" },
    { label: "Analyse & statistiques", description: "CA, encaissements, créances", href: "/statistiques", icon: BarChart3, privilege: "statistiques.view" },
  ],
  queues: [
    queue<Facture>({
      title: "Virements du Trésor attendus", path: "commercial/factures",
      params: () => ({ type_facturation: "VIREMENT_TRESOR", statut: "NON_PAYEE", ordering: "date_facture" }),
      privilege: "facture.view", href: "/commercial/factures", live: true,
      empty: "Aucun virement en attente.", row: factureRow,
    }),
    queue<CommandeRow>({
      title: "Commandes livrées à facturer", path: "commercial/commandes",
      params: () => ({ statut: "LIVREE" }), privilege: "commande.view", href: "/commercial/factures",
      empty: "Aucune commande en attente de facturation.", row: commandeRow,
    }),
  ],
};

const RECOUVREMENT: RoleDashboardDef = {
  role: "RECOUVREMENT",
  titre: "Recouvrement",
  description: "Suivi des factures privées impayées et des relances par paliers.",
  kpis: [
    { key: "echus", label: "Impayés échus", path: "recouvrement/dossiers/impayes", agg: { type: "length" }, privilege: "recouvrement.view", href: "/recouvrement", ton: "danger" },
    { key: "montant", label: "Montant échu", path: "recouvrement/dossiers/impayes", agg: { type: "sumArray", field: "montant_du" }, format: "ar", privilege: "recouvrement.view", href: "/recouvrement", ton: "danger" },
    { key: "en-cours", label: "Dossiers en cours", path: "recouvrement/dossiers", params: () => ({ statut: "EN_COURS" }), privilege: "recouvrement.view", href: "/recouvrement", ton: "attention" },
    { key: "contentieux", label: "Dossiers contentieux", path: "recouvrement/dossiers", params: () => ({ statut: "CONTENTIEUX" }), privilege: "recouvrement.view", href: "/recouvrement", ton: "danger" },
    { key: "bloques", label: "Clients bloqués", path: "clients/solvabilites", params: () => ({ statut_blocage: "1" }), privilege: "solvabilite.view", href: "/clients/solvabilites" },
  ],
  actions: [
    { label: "Ouvrir un dossier", description: "À partir des impayés échus", href: "/recouvrement", icon: AlertTriangle, privilege: "recouvrement.create" },
    { label: "Factures", description: "Reste à payer par client", href: "/commercial/factures", icon: Receipt, privilege: "facture.view" },
    { label: "Règlements reçus", description: "Paiements enregistrés", href: "/tresorerie/reglements", icon: Banknote, privilege: "reglement.view" },
    { label: "Clients", description: "Coordonnées et solvabilité", href: "/clients", icon: Users, privilege: "client.view" },
  ],
  queues: [
    queue<ImpayeRow>({
      title: "Impayés échus les plus anciens", path: "recouvrement/dossiers/impayes", array: true,
      privilege: "recouvrement.view", href: "/recouvrement", empty: "Aucun impayé échu.",
      row: (i) => ({
        titre: i.num_facture,
        detail: `${i.nom_client} · ${i.jours_retard} jour(s) de retard`,
        badge: <Badge variant="destructive">{formatAr(i.montant_du)}</Badge>,
        href: `/commercial/factures/${i.facture}`,
      }),
    }),
  ],
};

const PRODUCTION: RoleDashboardDef = {
  role: "PRODUCTION",
  titre: "Production",
  description: "Lancement et suivi des lots numérotés en série.",
  kpis: [
    { key: "planifies", label: "Lots planifiés", path: "produits/lots", params: () => ({ statut: "PLANIFIE" }), privilege: "lot.view", href: "/produits/lots", ton: "attention", live: true },
    { key: "en-cours", label: "Lots en cours", path: "produits/lots", params: () => ({ statut: "EN_COURS" }), privilege: "lot.view", href: "/produits/lots", live: true },
    { key: "preparations", label: "Préparations en cours", path: "commercial/preparations", params: () => ({ statut: "EN_COURS" }), privilege: "preparation.view", href: "/commercial/preparations" },
    { key: "produits", label: "Produits en série", path: "produits", params: () => ({ en_serie: "true" }), privilege: "produit.view", href: "/produits" },
  ],
  actions: [
    { label: "Lancer un lot", description: "Numérotation automatique", href: "/produits/lots", icon: Factory, privilege: "lot.create" },
    { label: "Produits", description: "Catalogue et séries", href: "/produits", icon: Package, privilege: "produit.view" },
    { label: "Préparations", description: "Lots à lier aux commandes", href: "/commercial/preparations", icon: PackageCheck, privilege: "preparation.view" },
  ],
  queues: [
    queue<LotRow>({
      title: "Lots en cours de production", path: "produits/lots",
      params: () => ({ statut: "EN_COURS" }), privilege: "lot.view", href: "/produits/lots", live: true,
      empty: "Aucun lot en cours.", row: lotRow,
    }),
    queue<LotRow>({
      title: "Lots planifiés", path: "produits/lots",
      params: () => ({ statut: "PLANIFIE" }), privilege: "lot.view", href: "/produits/lots", live: true,
      empty: "Aucun lot planifié.", row: lotRow,
    }),
  ],
};

const DIRECTION: RoleDashboardDef = {
  role: "DIRECTION",
  titre: "Direction",
  description: "Vue d'ensemble de l'activité commerciale et financière (lecture seule).",
  kpis: [
    { key: "commandes", label: "Commandes validées", path: "commercial/commandes", params: () => ({ statut: "VALIDEE" }), privilege: "commande.view", href: "/commercial/commandes" },
    { key: "non-payees", label: "Factures non payées", path: "commercial/factures", params: () => ({ statut: "NON_PAYEE" }), privilege: "facture.view", href: "/commercial/factures", ton: "attention" },
    { key: "contentieux", label: "Dossiers contentieux", path: "recouvrement/dossiers", params: () => ({ statut: "CONTENTIEUX" }), privilege: "recouvrement.view", href: "/recouvrement", ton: "danger" },
    { key: "engagements", label: "Engagements visés", path: "budget/engagements", params: () => ({ statut: "VISE" }), privilege: "engagement.view", href: "/budget/engagements" },
    { key: "bloques", label: "Clients privés bloqués", path: "clients/solvabilites", params: () => ({ statut_blocage: "1" }), privilege: "solvabilite.view", href: "/clients/solvabilites", ton: "danger" },
    { key: "lots", label: "Lots en production", path: "produits/lots", params: () => ({ statut: "EN_COURS" }), privilege: "lot.view", href: "/produits/lots" },
    { key: "caisses", label: "Solde des caisses", path: "tresorerie/caisses", agg: { type: "sum", field: "solde_actuel" }, format: "ar", privilege: "caisse.view", href: "/tresorerie/caisses" },
  ],
  actions: [
    { label: "Clients", description: "Tous les types", href: "/clients", icon: Users, privilege: ["client.view", "client_simple.view"] },
    { label: "Factures", description: "Paiements et impayés", href: "/commercial/factures", icon: Receipt, privilege: "facture.view" },
    { label: "Budgets", description: "Lignes et engagements", href: "/budget/budgets", icon: Wallet, privilege: "budget.view" },
    { label: "Journal d'audit", description: "Qui a fait quoi", href: "/audit", icon: ShieldCheck, privilege: "audit.view" },
    { label: "Analyse & statistiques", description: "CA, encaissements, créances", href: "/statistiques", icon: BarChart3, privilege: "statistiques.view" },
  ],
  queues: [
    queue<Facture>({
      title: "Factures non payées récentes", path: "commercial/factures",
      params: () => ({ statut: "NON_PAYEE", ordering: "-date_facture" }),
      privilege: "facture.view", href: "/commercial/factures", empty: "Aucune facture impayée.", row: factureRow,
    }),
  ],
};

const ADMIN: RoleDashboardDef = {
  role: "ADMIN",
  titre: "Administration",
  description: "Comptes, rôles et traçabilité du système.",
  kpis: [
    { key: "actifs", label: "Comptes actifs", path: "users/utilisateurs", params: () => ({ statut: "ACTIF" }), privilege: "utilisateur.view", href: "/admin/utilisateurs", ton: "succes" },
    { key: "inactifs", label: "Comptes inactifs", path: "users/utilisateurs", params: () => ({ statut: "INACTIF" }), privilege: "utilisateur.view", href: "/admin/utilisateurs" },
    { key: "suspendus", label: "Comptes suspendus", path: "users/utilisateurs", params: () => ({ statut: "SUSPENDU" }), privilege: "utilisateur.view", href: "/admin/utilisateurs", ton: "attention" },
    { key: "roles", label: "Rôles définis", path: "users/roles", privilege: "role.view", href: "/admin/roles" },
    { key: "audit", label: "Événements d'audit du jour", path: "audit/journal", params: () => ({ du: aujourdhui(), au: aujourdhui() }), privilege: "audit.view", href: "/audit" },
  ],
  actions: [
    { label: "Utilisateurs", description: "Comptes et mots de passe", href: "/admin/utilisateurs", icon: UserCog, privilege: "utilisateur.view" },
    { label: "Rôles & privilèges", description: "Droits par rôle", href: "/admin/roles", icon: KeyRound, privilege: "role.view" },
    { label: "Journal d'audit", description: "Historique des opérations", href: "/audit", icon: ShieldCheck, privilege: "audit.view" },
    { label: "Clients", description: "Tous les types", href: "/clients", icon: Users, privilege: ["client.view", "client_simple.view"] },
  ],
  queues: [
    queue<AuditRow>({
      title: "Derniers événements d'audit", path: "audit/journal", limit: 8,
      privilege: "audit.view", href: "/audit", empty: "Aucun événement.",
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