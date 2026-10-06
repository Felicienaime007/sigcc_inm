export interface Level {
  key: string;
  label: string;
  path: string;
  idKey: string;
  nameKey: string;
  /** Nom du champ clé étrangère vers le niveau supérieur (identique au paramètre de filtre de l'API). */
  parentField: string | null;
}

/** Hiérarchie administrative, du plus haut niveau au plus bas. */
export const LEVELS: Level[] = [
  { key: "province", label: "Province", path: "territoire/provinces", idKey: "id_province", nameKey: "nom_province", parentField: null },
  { key: "region", label: "Région", path: "territoire/regions", idKey: "id_region", nameKey: "nom_region", parentField: "province" },
  { key: "district", label: "District", path: "territoire/districts", idKey: "id_district", nameKey: "nom_district", parentField: "region" },
  { key: "commune", label: "Commune", path: "territoire/communes", idKey: "id_commune", nameKey: "nom_commune", parentField: "district" },
  { key: "fokontany", label: "Fokontany", path: "territoire/fokontany", idKey: "id_fokontany", nameKey: "nom_fokontany", parentField: "commune" },
];

export type Ligne = Record<string, string | number | null>;

export const TYPES_COMMUNE = [
  { value: "URBAINE", label: "Urbaine" },
  { value: "RURALE", label: "Rurale" },
];

export interface ColonneCfg {
  key: string;
  header: string;
  field: string;
  sortKey?: string;
  format?: "typeCommune";
}

export interface NiveauCfg {
  index: number;               // position dans LEVELS
  priv: string;                // préfixe des privilèges : "region" -> region.view, region.create...
  tab: string;                 // libellé de l'onglet
  titre: string;
  nom: string;                 // « la région », utilisé dans les messages
  nouveau: string;
  modifier: string;
  supprimer: string;
  recherche: string;
  colonnes: ColonneCfg[];
  /** Pour les filtres : {indice du niveau parent: paramètre accepté par l'API}. */
  filterParams: Record<number, string>;
  typeCommune?: boolean;
}

export const NIVEAUX: NiveauCfg[] = [
  {
    index: 0, priv: "province", tab: "Provinces", titre: "Provinces", nom: "la province",
    nouveau: "Nouvelle province", modifier: "Modifier la province", supprimer: "Supprimer la province ?",
    recherche: "Rechercher une province…",
    colonnes: [{ key: "nom", header: "Province", field: "nom_province", sortKey: "nom_province" }],
    filterParams: {},
  },
  {
    index: 1, priv: "region", tab: "Régions", titre: "Régions", nom: "la région",
    nouveau: "Nouvelle région", modifier: "Modifier la région", supprimer: "Supprimer la région ?",
    recherche: "Rechercher une région…",
    colonnes: [
      { key: "nom", header: "Région", field: "nom_region", sortKey: "nom_region" },
      { key: "prov", header: "Province", field: "nom_province", sortKey: "nom_province" },
    ],
    filterParams: { 0: "province" },
  },
  {
    index: 2, priv: "district", tab: "Districts", titre: "Districts", nom: "le district",
    nouveau: "Nouveau district", modifier: "Modifier le district", supprimer: "Supprimer le district ?",
    recherche: "Rechercher un district…",
    colonnes: [
      { key: "nom", header: "District", field: "nom_district", sortKey: "nom_district" },
      { key: "reg", header: "Région", field: "nom_region", sortKey: "nom_region" },
    ],
    filterParams: { 0: "province", 1: "region" },
  },
  {
    index: 3, priv: "commune", tab: "Communes", titre: "Communes", nom: "la commune",
    nouveau: "Nouvelle commune", modifier: "Modifier la commune", supprimer: "Supprimer la commune ?",
    recherche: "Rechercher une commune…",
    typeCommune: true,
    colonnes: [
      { key: "nom", header: "Commune", field: "nom_commune", sortKey: "nom_commune" },
      { key: "type", header: "Type", field: "type_commune", sortKey: "type_commune", format: "typeCommune" },
      { key: "dist", header: "District", field: "nom_district", sortKey: "nom_district" },
    ],
    filterParams: { 1: "region", 2: "district" },
  },
  {
    index: 4, priv: "fokontany", tab: "Fokontany", titre: "Fokontany", nom: "le fokontany",
    nouveau: "Nouveau fokontany", modifier: "Modifier le fokontany", supprimer: "Supprimer le fokontany ?",
    recherche: "Rechercher un fokontany…",
    colonnes: [
      { key: "nom", header: "Fokontany", field: "nom_fokontany", sortKey: "nom_fokontany" },
      { key: "com", header: "Commune", field: "nom_commune", sortKey: "nom_commune" },
      { key: "dist", header: "District", field: "nom_district", sortKey: "nom_district" },
      { key: "reg", header: "Région", field: "nom_region", sortKey: "nom_region" },
      { key: "prov", header: "Province", field: "nom_province", sortKey: "nom_province" },
    ],
    filterParams: { 1: "region", 2: "district", 3: "commune" },
  },
];