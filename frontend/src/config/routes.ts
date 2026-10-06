/**
 * Pages réellement livrées. Tout lien vers une autre page est grisé « Bientôt ».
 * À chaque nouvelle étape frontend, ajoutez ici les routes qu'elle crée.
 */
export const ROUTES_PRETES = [
  "/",
  "/profil",
  "/clients",
  "/clients/solvabilites",
  "/organismes",
  "/territoire",
  "/comptoir",
  "/commercial/factures",
  "/commercial/livraisons",
  "/commercial/avoirs",
  "/commercial/preparations",
  "/produits/categories",
  "/admin/utilisateurs",
  "/admin/roles",
  "/admin/privileges",
  "/tresorerie/reglements",
  "/tresorerie/quittances",
  "/tresorerie/caisses",
  "/budget/budgets",
  "/budget/engagements",
  "/commercial/planifications",
  "/commercial/devis",
  "/commercial/commandes",
  "/produits",
  "/produits/lots",
  "/stock",
  "/stock/mouvements",
  "/stock/reservations",
  "/stock/magasins",
  "/recouvrement",
  "/statistiques",
  "/audit",
];

export function estPrete(href: string): boolean {
  return ROUTES_PRETES.some((r) => href === r || (r !== "/" && href.startsWith(`${r}/`)));
}