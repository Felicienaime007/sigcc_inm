"use client";

import type { Dict } from "./types";

/** Fusion profonde de dictionnaires (les modules complètent le socle fr/en/mg). */
export function fusionnerDicts(...dicts: Dict[]): Dict {
  const resultat: Dict = {};
  for (const d of dicts) {
    for (const [cle, valeur] of Object.entries(d)) {
      const actuel = resultat[cle];
      if (
        typeof valeur === "object" && valeur !== null &&
        typeof actuel === "object" && actuel !== null
      ) {
        resultat[cle] = fusionnerDicts(actuel as Dict, valeur as Dict);
      } else {
        resultat[cle] = valeur;
      }
    }
  }
  return resultat;
}
