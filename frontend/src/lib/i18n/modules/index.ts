"use client";

import type { Dict, Langue } from "../types";
import { tresorerieFr, tresorerieEn, tresorerieMg } from "./tresorerie";
import { commercialFr, commercialEn, commercialMg } from "./commercial";
import { stockFr, stockEn, stockMg } from "./stock";
import { clientFr, clientEn, clientMg } from "./client";
import { adminFr, adminEn, adminMg } from "./admin";

/** Modules de traduction par domaine. Ajouter ici tout nouveau `modules/<domaine>.ts`. */
interface ModuleTrad {
  fr: Dict;
  en: Dict;
  mg: Dict;
}

const MODULES: ModuleTrad[] = [
  { fr: tresorerieFr, en: tresorerieEn, mg: tresorerieMg },
  { fr: commercialFr, en: commercialEn, mg: commercialMg },
  { fr: stockFr, en: stockEn, mg: stockMg },
  { fr: clientFr, en: clientEn, mg: clientMg },
  { fr: adminFr, en: adminEn, mg: adminMg },
];

export function dictsModules(): Record<Langue, Dict[]> {
  return {
    fr: MODULES.map((m) => m.fr),
    en: MODULES.map((m) => m.en),
    mg: MODULES.map((m) => m.mg),
  };
}
