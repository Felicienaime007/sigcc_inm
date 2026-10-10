"use client";

/** Langues disponibles dans toute l'application. */
export type Langue = "fr" | "en" | "mg";

export const LANGUES: { code: Langue; label: string; court: string }[] = [
  { code: "fr", label: "Français", court: "FR" },
  { code: "en", label: "English", court: "EN" },
  { code: "mg", label: "Malagasy", court: "MG" },
];

/** Dictionnaire imbriqué : toute feuille est une chaîne. */
export interface Dict {
  [cle: string]: string | Dict;
}

/** Recherche « a.b.c » avec repli sur le français, puis sur la clé elle-même. */
export function chercher(dicts: Record<Langue, Dict>, langue: Langue, chemin: string): string {
  return lirePour(dicts[langue], chemin) ?? lirePour(dicts.fr, chemin) ?? chemin;
}

function lirePour(d: Dict, chemin: string): string | undefined {
  let noeud: string | Dict | undefined = d;
  for (const part of chemin.split(".")) {
    if (typeof noeud !== "object" || noeud === null) return undefined;
    noeud = noeud[part];
  }
  return typeof noeud === "string" ? noeud : undefined;
}
