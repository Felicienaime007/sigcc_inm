"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Dict, Langue } from "./types";
import { chercher } from "./types";
import { fr } from "./fr";
import { en } from "./en";
import { mg } from "./mg";
import { fusionnerDicts } from "./fusion";
import { dictsModules } from "./modules";
import { configurerLocalisation } from "../format";

const CLE = "sigcc_langue";

const MODS = dictsModules();
const DICTS: Record<Langue, Dict> = {
  fr: fusionnerDicts(fr, ...MODS.fr),
  en: fusionnerDicts(en, ...MODS.en),
  mg: fusionnerDicts(mg, ...MODS.mg),
};

export type ParamsTraduction = Record<string, string | number>;

function appliquer(obj: string, params?: ParamsTraduction): string {
  if (!params) return obj;
  return Object.entries(params).reduce(
    (s, [k, v]) => s.replaceAll(`{${k}}`, String(v)),
    obj,
  );
}

interface ValeurContexte {
  langue: Langue;
  changer: (l: Langue) => void;
  t: (chemin: string, params?: ParamsTraduction) => string;
}

const Contexte = createContext<ValeurContexte>({
  langue: "fr",
  changer: () => undefined,
  t: (chemin: string) => chemin,
});

function lireInitiale(): Langue {
  if (typeof window === "undefined") return "fr";
  const v = window.localStorage.getItem(CLE);
  return v === "en" || v === "mg" ? v : "fr";
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [langue, setLangue] = useState<Langue>(lireInitiale);

  useEffect(() => {
    document.documentElement.lang = langue;
    configurerLocalisation(langue);
  }, [langue]);

  const changer = useCallback((l: Langue) => {
    setLangue(l);
    try {
      window.localStorage.setItem(CLE, l);
    } catch {
      /* stockage indisponible : on ignore */
    }
  }, []);

  const t = useCallback(
    (chemin: string, params?: ParamsTraduction) => appliquer(chercher(DICTS, langue, chemin), params),
    [langue],
  );

  const valeur = useMemo(() => ({ langue, changer, t }), [langue, changer, t]);
  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useLangue(): ValeurContexte {
  return useContext(Contexte);
}

/** Raccourci : `const { t } = useT();` puis `t("nav.items.clients")`. */
export function useT(): { t: ValeurContexte["t"]; langue: Langue } {
  const { t, langue } = useContext(Contexte);
  return { t, langue };
}
