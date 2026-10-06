export const NIVEAUX = [
  { value: "1", label: "Niveau 1 — Amiable" },
  { value: "2", label: "Niveau 2 — Relance ferme" },
  { value: "3", label: "Niveau 3 — Contentieux" },
];

export const STATUTS_DOSSIER = [
  { value: "EN_COURS", label: "En cours" },
  { value: "CONTENTIEUX", label: "Contentieux" },
  { value: "REGLE", label: "Réglé" },
];

export const libelleNiveau = (n: number) => NIVEAUX.find((x) => x.value === String(n))?.label ?? `Niveau ${n}`;

/** Ce que fait le passage au niveau suivant (pour la confirmation). */
export const effetEscalade = (niveauActuel: number) =>
  niveauActuel === 1
    ? "Le dossier passe au niveau 2 (relance ferme)."
    : "Le dossier passe au niveau 3 : il devient un contentieux.";