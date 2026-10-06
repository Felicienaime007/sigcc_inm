export const TYPES_MOUVEMENT = [
  { value: "ENTREE_PRODUCTION", label: "Entrée — production" },
  { value: "ENTREE_RETOUR", label: "Entrée — retour client" },
  { value: "ENTREE_INITIAL", label: "Entrée — stock initial" },
  { value: "ENTREE_AJUSTEMENT", label: "Entrée — ajustement" },
  { value: "SORTIE_LIVRAISON", label: "Sortie — livraison" },
  { value: "SORTIE_AJUSTEMENT", label: "Sortie — ajustement" },
  { value: "TRANSFERT_SORTIE", label: "Transfert — sortie" },
  { value: "TRANSFERT_ENTREE", label: "Transfert — entrée" },
];

/** Types qu'un utilisateur peut saisir à la main (les autres sont générés par le système). */
export const TYPES_SAISIE = [
  { value: "ENTREE_INITIAL", label: "Entrée — stock initial / inventaire" },
  { value: "ENTREE_AJUSTEMENT", label: "Entrée — ajustement" },
  { value: "SORTIE_AJUSTEMENT", label: "Sortie — casse, perte, ajustement" },
];

export const libelleType = (t: string) => TYPES_MOUVEMENT.find((x) => x.value === t)?.label ?? t;

export const estEntree = (t: string) => t.startsWith("ENTREE") || t === "TRANSFERT_ENTREE";

export const libelleEmplacement = (e: { code_depot: string; code_allee: string; code_etagere: string }) =>
  `${e.code_depot} · allée ${e.code_allee} · étagère ${e.code_etagere}`;