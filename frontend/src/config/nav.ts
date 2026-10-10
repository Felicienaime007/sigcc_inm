import {
  AlertTriangle, Banknote, Boxes, Building2, ClipboardList, FileText, Factory,
  Landmark, LayoutDashboard, MapPin, Package, PackageCheck, Receipt, ReceiptText,
  ScrollText, ShieldCheck, ShoppingCart, Truck, Undo2, UserCog, Users, Wallet,
  Warehouse, KeyRound, ArrowLeftRight, Lock, Gauge, Store, BookmarkCheck, LayoutGrid, BarChart3,
  ClipboardCheck,
  type LucideIcon,
  FileSpreadsheet,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  privilege?: string | string[];
  /**
   * Rôles autorisés à voir l'entrée. Si absent : visible par tous (sous réserve
   * du privilège). ADMIN voit tout, quel que soit ce champ.
   * Aligné sur les tableaux de bord par rôle (role-dashboards.tsx) :
   * chaque rôle ne voit que les pages de son périmètre.
   */
  roles?: string[];
}
export interface NavGroup {
  label: string;
  items: NavItem[];
}

// Acteurs de la facturation/livraison : la réception n'y figure pas —
// elle crée la vente au comptoir, le caissier encaisse, le BL suit.
const ACTEURS_FACTURES = ["COMMERCIAL", "MAGASINIER", "CAISSIER", "COMPTABLE", "RECOUVREMENT", "DIRECTION", "PRODUCTION"];

export const NAV: NavGroup[] = [
  {
    label: "nav.groupes.pilotage",
    items: [
      { href: "/", label: "nav.items.tableau_bord", icon: LayoutDashboard },
      { href: "/statistiques", label: "nav.items.stats", icon: BarChart3, privilege: "statistiques.view", roles: ["DIRECTION", "COMPTABLE"] },
    ],
  },
  {
    label: "nav.groupes.commercial",
    items: [
      // Client SIMPLE géré uniquement à la réception (comptoir).
      { href: "/comptoir", label: "nav.items.comptoir", icon: Store, privilege: "client_simple.create", roles: ["RECEPTION"] },
      // La réception ne gère pas les clients : elle ne fait que la vente au comptoir
      // (le client de passage est saisi dans /comptoir). Pas de RECEPTION ici.
      { href: "/clients", label: "nav.items.clients", icon: Users, privilege: ["client.view", "client_simple.view"], roles: ["COMMERCIAL", "MAGASINIER", "CAISSIER", "COMPTABLE", "RECOUVREMENT", "DIRECTION"] },
      // Circuit commercial : MINISTERE, CTD, PRIVE uniquement (jamais SIMPLE).
      // Solvabilité visible par tous les rôles qui ont solvabilite.view
      // (COMMERCIAL, MAGASINIER, CAISSIER, COMPTABLE, RECOUVREMENT, DIRECTION + ADMIN).
      { href: "/clients/solvabilites", label: "nav.items.solvabilite", icon: Gauge, privilege: "solvabilite.view", roles: ["COMMERCIAL", "MAGASINIER", "CAISSIER", "COMPTABLE", "RECOUVREMENT", "DIRECTION"] },
      { href: "/commercial/planifications", label: "nav.items.planifications", icon: ClipboardList, privilege: "planification.view", roles: ["COMMERCIAL", "DIRECTION"] },
      { href: "/commercial/devis", label: "nav.items.devis", icon: FileText, privilege: "devis.view", roles: ["COMMERCIAL", "DIRECTION"] },
      { href: "/commercial/commandes", label: "nav.items.commandes", icon: ShoppingCart, privilege: "commande.view", roles: ["COMMERCIAL", "MAGASINIER", "COMPTABLE", "DIRECTION"] },
      { href: "/commercial/preparations", label: "nav.items.preparations", icon: PackageCheck, privilege: "preparation.view", roles: ["MAGASINIER", "PRODUCTION", "COMMERCIAL", "DIRECTION"] },
      { href: "/commercial/livraisons", label: "nav.items.livraisons", icon: Truck, privilege: "livraison.view", roles: ["MAGASINIER", "DIRECTION"] },
      { href: "/commercial/factures", label: "nav.items.factures", icon: Receipt, privilege: "facture.view", roles: ACTEURS_FACTURES },
      { href: "/commercial/avoirs", label: "nav.items.avoirs", icon: Undo2, privilege: "avoir.view", roles: ["MAGASINIER", "COMPTABLE", "DIRECTION"] },
    ],
  },
  {
    label: "nav.groupes.stock",
    items: [
      { href: "/produits", label: "nav.items.produits", icon: Package, privilege: "produit.view", roles: ["RECEPTION", "COMMERCIAL", "MAGASINIER", "PRODUCTION", "DIRECTION"] },
      { href: "/produits/lots", label: "nav.items.lots", icon: Factory, privilege: "lot.view", roles: ["PRODUCTION", "DIRECTION"] },
      { href: "/stock", label: "nav.items.stock", icon: Warehouse, privilege: "stock.view", roles: ["RECEPTION", "COMMERCIAL", "MAGASINIER", "PRODUCTION", "DIRECTION"] },
      { href: "/stock/inventaires", label: "nav.items.inventaires", icon: ClipboardCheck, privilege: "inventaire.view", roles: ["MAGASINIER", "DIRECTION"] },
      { href: "/stock/mouvements", label: "nav.items.mouvements", icon: ArrowLeftRight, privilege: "mouvement.view", roles: ["MAGASINIER", "DIRECTION"] },
      { href: "/stock/reservations", label: "nav.items.reservations", icon: BookmarkCheck, privilege: "reservation.view", roles: ["MAGASINIER", "COMMERCIAL", "DIRECTION"] },
      { href: "/stock/magasins", label: "nav.items.magasins", icon: LayoutGrid, privilege: "magasin.view", roles: ["MAGASINIER", "DIRECTION"] },
    ],
  },
  {
    label: "nav.groupes.finances",
    items: [
      { href: "/budget/budgets", label: "nav.items.budgets", icon: Wallet, privilege: "budget.view", roles: ["COMPTABLE", "DIRECTION"] },
      { href: "/budget/engagements", label: "nav.items.engagements", icon: ScrollText, privilege: "engagement.view", roles: ["COMPTABLE", "COMMERCIAL", "DIRECTION"] },
      { href: "/tresorerie/reglements", label: "nav.items.reglements", icon: Banknote, privilege: "reglement.view", roles: ["CAISSIER", "COMPTABLE", "RECOUVREMENT", "DIRECTION"] },
      { href: "/tresorerie/caisses", label: "nav.items.caisses", icon: Landmark, privilege: "caisse.view", roles: ["CAISSIER", "DIRECTION"] },
      { href: "/tresorerie/quittances", label: "nav.items.quittances", icon: ReceiptText, privilege: "quittance.view", roles: ["CAISSIER", "DIRECTION"] },
      { href: "/recouvrement", label: "nav.items.recouvrement", icon: AlertTriangle, privilege: "recouvrement.view", roles: ["RECOUVREMENT", "COMPTABLE", "COMMERCIAL", "CAISSIER", "DIRECTION"] },
      { href: "/etats", label: "nav.items.etats", icon: FileSpreadsheet,
        privilege: ["etat.view", "etat_ventes.view", "etat_encaissements.view", "etat_creances.view", "etat_caisse.view", "etat_budget.view"],
        roles: ["CAISSIER", "COMPTABLE", "RECOUVREMENT", "DIRECTION"] },
    ],
  },
  {
    label: "nav.groupes.referentiels",
    items: [
      { href: "/organismes", label: "nav.items.organismes", icon: Building2, privilege: "organisme.view", roles: ["COMMERCIAL", "COMPTABLE", "DIRECTION"] },
      { href: "/territoire", label: "nav.items.territoire", icon: MapPin, privilege: "province.view", roles: ["COMMERCIAL", "DIRECTION"] },
      { href: "/produits/categories", label: "nav.items.categories", icon: Boxes, privilege: "categorie.view", roles: ["COMMERCIAL", "MAGASINIER", "PRODUCTION", "DIRECTION"] },
    ],
  },
  {
    label: "nav.groupes.administration",
    items: [
      { href: "/admin/utilisateurs", label: "nav.items.utilisateurs", icon: UserCog, privilege: "utilisateur.view", roles: ["ADMIN"] },
      { href: "/admin/roles", label: "nav.items.roles", icon: KeyRound, privilege: "role.view", roles: ["ADMIN"] },
      { href: "/admin/privileges", label: "nav.items.privileges", icon: Lock, privilege: "privilege.view", roles: ["ADMIN"] },
      { href: "/audit", label: "nav.items.audit", icon: ShieldCheck, privilege: "audit.view", roles: ["ADMIN", "DIRECTION"] },
    ],
  },
];
