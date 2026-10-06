import {
  AlertTriangle, Banknote, Boxes, Building2, ClipboardList, FileText, Factory,
  Landmark, LayoutDashboard, MapPin, Package, PackageCheck, Receipt, ReceiptText,
  ScrollText, ShieldCheck, ShoppingCart, Truck, Undo2, UserCog, Users, Wallet,
  Warehouse, KeyRound, ArrowLeftRight, Lock, Gauge, Store, BookmarkCheck, LayoutGrid, BarChart3,
  type LucideIcon,
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

const TOUS_SAUFS_PROD = ["RECEPTION", "COMMERCIAL", "MAGASINIER", "CAISSIER", "COMPTABLE", "RECOUVREMENT", "DIRECTION"];

export const NAV: NavGroup[] = [
  {
    label: "Pilotage",
    items: [
      { href: "/", label: "Tableau de bord", icon: LayoutDashboard },
      { href: "/statistiques", label: "Analyse & statistiques", icon: BarChart3, privilege: "statistiques.view", roles: ["DIRECTION", "COMPTABLE"] },
    ],
  },
  {
    label: "Commercial",
    items: [
      // Client SIMPLE géré uniquement à la réception (comptoir).
      { href: "/comptoir", label: "Vente comptoir", icon: Store, privilege: "client_simple.create", roles: ["RECEPTION"] },
      { href: "/clients", label: "Clients", icon: Users, privilege: ["client.view", "client_simple.view"], roles: TOUS_SAUFS_PROD },
      // Circuit commercial : MINISTERE, CTD, PRIVE uniquement (jamais SIMPLE).
      { href: "/clients/solvabilites", label: "Solvabilité", icon: Gauge, privilege: "solvabilite.view", roles: ["COMMERCIAL", "COMPTABLE", "DIRECTION"] },
      { href: "/commercial/planifications", label: "Planifications", icon: ClipboardList, privilege: "planification.view", roles: ["COMMERCIAL", "DIRECTION"] },
      { href: "/commercial/devis", label: "Devis", icon: FileText, privilege: "devis.view", roles: ["COMMERCIAL", "DIRECTION"] },
      { href: "/commercial/commandes", label: "Commandes", icon: ShoppingCart, privilege: "commande.view", roles: ["COMMERCIAL", "MAGASINIER", "COMPTABLE", "DIRECTION"] },
      { href: "/commercial/preparations", label: "Préparations", icon: PackageCheck, privilege: "preparation.view", roles: ["MAGASINIER", "PRODUCTION", "COMMERCIAL", "DIRECTION"] },
      { href: "/commercial/livraisons", label: "Livraisons", icon: Truck, privilege: "livraison.view", roles: ["MAGASINIER", "RECEPTION", "DIRECTION"] },
      { href: "/commercial/factures", label: "Factures", icon: Receipt, privilege: "facture.view", roles: [...TOUS_SAUFS_PROD, "PRODUCTION"] },
      { href: "/commercial/avoirs", label: "Avoirs", icon: Undo2, privilege: "avoir.view", roles: ["MAGASINIER", "COMPTABLE", "DIRECTION"] },
    ],
  },
  {
    label: "Stock & produits",
    items: [
      { href: "/produits", label: "Produits", icon: Package, privilege: "produit.view", roles: ["RECEPTION", "COMMERCIAL", "MAGASINIER", "PRODUCTION", "DIRECTION"] },
      { href: "/produits/lots", label: "Lots de production", icon: Factory, privilege: "lot.view", roles: ["PRODUCTION", "DIRECTION"] },
      { href: "/stock", label: "Niveaux de stock", icon: Warehouse, privilege: "stock.view", roles: ["RECEPTION", "COMMERCIAL", "MAGASINIER", "PRODUCTION", "DIRECTION"] },
      { href: "/stock/mouvements", label: "Mouvements", icon: ArrowLeftRight, privilege: "mouvement.view", roles: ["MAGASINIER", "DIRECTION"] },
      { href: "/stock/reservations", label: "Réservations", icon: BookmarkCheck, privilege: "reservation.view", roles: ["MAGASINIER", "COMMERCIAL", "DIRECTION"] },
      { href: "/stock/magasins", label: "Magasins & emplacements", icon: LayoutGrid, privilege: "magasin.view", roles: ["MAGASINIER", "DIRECTION"] },
    ],
  },
  {
    label: "Finances",
    items: [
      { href: "/budget/budgets", label: "Budgets", icon: Wallet, privilege: "budget.view", roles: ["COMPTABLE", "DIRECTION"] },
      { href: "/budget/engagements", label: "Engagements", icon: ScrollText, privilege: "engagement.view", roles: ["COMPTABLE", "COMMERCIAL", "DIRECTION"] },
      { href: "/tresorerie/reglements", label: "Règlements", icon: Banknote, privilege: "reglement.view", roles: ["CAISSIER", "COMPTABLE", "RECOUVREMENT", "DIRECTION"] },
      { href: "/tresorerie/caisses", label: "Caisses", icon: Landmark, privilege: "caisse.view", roles: ["CAISSIER", "DIRECTION"] },
      { href: "/tresorerie/quittances", label: "Quittances", icon: ReceiptText, privilege: "quittance.view", roles: ["CAISSIER", "DIRECTION"] },
      { href: "/recouvrement", label: "Recouvrement", icon: AlertTriangle, privilege: "recouvrement.view", roles: ["RECOUVREMENT", "COMPTABLE", "COMMERCIAL", "CAISSIER", "DIRECTION"] },
    ],
  },
  {
    label: "Référentiels",
    items: [
      { href: "/organismes", label: "Organismes", icon: Building2, privilege: "organisme.view", roles: ["COMMERCIAL", "COMPTABLE", "DIRECTION"] },
      { href: "/territoire", label: "Territoire", icon: MapPin, privilege: "province.view", roles: ["COMMERCIAL", "DIRECTION"] },
      { href: "/produits/categories", label: "Catégories", icon: Boxes, privilege: "categorie.view", roles: ["COMMERCIAL", "MAGASINIER", "PRODUCTION", "DIRECTION"] },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/admin/utilisateurs", label: "Utilisateurs", icon: UserCog, privilege: "utilisateur.view", roles: ["ADMIN"] },
      { href: "/admin/roles", label: "Rôles & privilèges", icon: KeyRound, privilege: "role.view", roles: ["ADMIN"] },
      { href: "/admin/privileges", label: "Catalogue des privilèges", icon: Lock, privilege: "privilege.view", roles: ["ADMIN"] },
      { href: "/audit", label: "Journal d'audit", icon: ShieldCheck, privilege: "audit.view", roles: ["ADMIN", "DIRECTION"] },
    ],
  },
];
