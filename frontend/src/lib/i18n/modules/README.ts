"use client";

/**
 * CONVENTION DE TRADUCTION (à suivre dans tout le projet)
 *
 * 1. Chaque domaine possède son fichier ici : `modules/<domaine>.ts` qui exporte
 *    `tresorerieFr`, `tresorerieEn`, `tresorerieMg` (objets `Dict` imbriqués).
 * 2. Clés en minuscules avec points : `tresorerie.caisses.titre`. Le français
 *    sert de repli : toute clé absente en en/mg affiche le français.
 * 3. Dans les composants : `const { t } = useT();` puis `t("domaine.page.cle")`,
 *    `t("domaine.page.message", { n: count })` pour les interpolations `{n}`.
 * 4. Ne traduire QUE les chaînes affichées (JSX, title, aria-label, placeholder,
 *    toasts). Ne jamais modifier la logique, les appels API, les routes, les styles.
 * 5. Enregistrer le module dans `modules/index.ts` (tableau MODULES).
 *
 * Exemple de module :
 *
 *   import type { Dict } from "../types";
 *   export const tresorerieFr: Dict = { tresorerie: { caisses: { titre: "Caisses" } } };
 *   export const tresorerieEn: Dict = { tresorerie: { caisses: { titre: "Cash registers" } } };
 *   export const tresorerieMg: Dict = { tresorerie: { caisses: { titre: "Vata-bola" } } };
 */
export {};
