import type { Langue } from "./i18n/types";

const LOCALES: Record<Langue, string> = { fr: "fr-FR", en: "en-GB", mg: "mg-MG" };

let locale = LOCALES.fr;

function fabrique() {
  return {
    nombre: new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }),
    date: new Intl.DateTimeFormat(locale, { dateStyle: "short", timeZone: "Indian/Antananarivo" }),
    dateHeure: new Intl.DateTimeFormat(locale, {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "Indian/Antananarivo",
    }),
    compact: new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }),
  };
}

let fmt = fabrique();

/** Appelé par le fournisseur de langue : nombres et dates suivent la langue choisie. */
export function configurerLocalisation(langue: Langue) {
  locale = LOCALES[langue] ?? LOCALES.fr;
  fmt = fabrique();
}

type Valeur = number | string | null | undefined;

export function formatNombre(v: Valeur): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string" && v.trim() === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return fmt.nombre.format(n);
}

/** Montant en ariary. L'API renvoie les décimaux sous forme de chaînes ("1340000.00"). */
export function formatAr(v: Valeur): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string" && v.trim() === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${fmt.nombre.format(n)} Ar`;
}

export function formatDate(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return fmt.date.format(d);
}

export function formatDateTime(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return fmt.dateHeure.format(d);
}

export function formatCompact(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  return fmt.compact.format(Number(v));
}

/** Aujourd'hui (AAAA-MM-JJ) au fuseau de l'INM — pour les valeurs par défaut des filtres. */
export function dateLocaleISO(d = new Date()): string {
  const fmt = new Intl.DateTimeFormat("fr-CA", {
    year: "numeric", month: "2-digit", day: "2-digit",
    timeZone: "Indian/Antananarivo",
  });
  return fmt.format(d);
}