"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from "react";

export type Theme = "light" | "dark" | "system";

const CLE = "theme"; // même clé que next-themes : la préférence existante est conservée
const CLASSE_SANS_TRANSITION = "bloque-transitions-theme";

function lireStocke(): Theme {
  try {
    const v = window.localStorage.getItem(CLE);
    return v === "light" || v === "dark" || v === "system" ? v : "system";
  } catch {
    return "system";
  }
}

function systemeSombre(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function appliquer(resolu: "light" | "dark") {
  const racine = document.documentElement;
  racine.classList.remove("light", "dark");
  racine.classList.add(resolu);
  racine.style.colorScheme = resolu;
}

interface ContexteTheme {
  theme: Theme;
  resolvedTheme: "light" | "dark" | undefined;
  setTheme: (t: Theme) => void;
}

const Contexte = createContext<ContexteTheme>({ theme: "system", resolvedTheme: undefined, setTheme: () => undefined });

/**
 * Fournisseur de thème (remplace next-themes, dont le <script> inline est
 * rejeté par React 19 en développement). Même API : attribute="class",
 * thème "system" par défaut, classe "dark"/"light" sur <html> appliquée
 * avant peinture (useLayoutEffect), préférence persistée (localStorage
 * "theme"). Aucune balise <script> dans l'arbre React.
 */
export function ThemeProvider({
  children,
  defaultTheme = "system",
  enableSystem = true,
  disableTransitionOnChange,
}: {
  children: React.ReactNode;
  attribute?: "class";
  defaultTheme?: Theme;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
}) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [monte, setMonte] = useState(false);
  const [systeme, setSysteme] = useState(false);

  // Préférence stockée lue une fois le composant monté (pas de window au SSR).
  useLayoutEffect(() => {
    setThemeState(lireStocke());
    setSysteme(systemeSombre());
    setMonte(true);
  }, []);

  // Suit le système quand le thème est "system".
  useEffect(() => {
    if (!enableSystem) return;
    const req = window.matchMedia("(prefers-color-scheme: dark)");
    const maj = (e: MediaQueryListEvent) => setSysteme(e.matches);
    req.addEventListener("change", maj);
    return () => req.removeEventListener("change", maj);
  }, [enableSystem]);

  const resolu: "light" | "dark" = theme === "system" ? (systeme ? "dark" : "light") : theme;

  // Appliqué avant peinture (pas de flash), transitions coupées si demandé.
  useLayoutEffect(() => {
    if (!monte) return;
    const racine = document.documentElement;
    if (disableTransitionOnChange) racine.classList.add(CLASSE_SANS_TRANSITION);
    appliquer(resolu);
    if (disableTransitionOnChange) {
      // Reflow synchrone : la coupure ne dure que le changement de classe.
      void racine.offsetHeight;
      racine.classList.remove(CLASSE_SANS_TRANSITION);
    }
  }, [monte, resolu, disableTransitionOnChange]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      window.localStorage.setItem(CLE, t);
    } catch {
      /* stockage indisponible : le thème s'applique quand même */
    }
  }, []);

  const valeur = useMemo<ContexteTheme>(
    () => ({ theme, resolvedTheme: monte ? resolu : undefined, setTheme }),
    [theme, monte, resolu, setTheme],
  );
  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useTheme(): ContexteTheme {
  return useContext(Contexte);
}
