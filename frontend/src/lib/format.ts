const nombre = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeZone: "Indian/Antananarivo" });
const dateHeure = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Indian/Antananarivo",
});
const compact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });
type Valeur = number | string | null | undefined;

export function formatNombre(v: Valeur): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string" && v.trim() === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return nombre.format(n);
}

/** Montant en ariary. L'API renvoie les décimaux sous forme de chaînes ("1340000.00"). */
export function formatAr(v: Valeur): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string" && v.trim() === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${nombre.format(n)} Ar`;
}

export function formatDate(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return date.format(d);
}

export function formatDateTime(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return dateHeure.format(d);
}

export function formatCompact(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  return compact.format(Number(v));
}