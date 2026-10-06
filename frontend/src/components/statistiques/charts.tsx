import type { ReactNode } from "react";
import { formatAr, formatCompact, formatNombre } from "@/lib/format";
import { cn } from "@/lib/utils";

const MOIS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

export interface SerieMensuelle {
  label: string;
  className: string;       // couleur de la barre, ex. "bg-primary"
  values: number[];        // 12 valeurs
}

/** Barres groupées par mois, en CSS pur. */
export function BarresMensuelles({ series, hauteur = 220 }: { series: SerieMensuelle[]; hauteur?: number }) {
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 text-xs">
        {series.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span className={cn("h-2.5 w-2.5 rounded-sm", s.className)} /> {s.label}
          </span>
        ))}
      </div>
      <div className="flex" style={{ height: hauteur }}>
        <div className="flex w-14 shrink-0 flex-col justify-between pr-2 text-right text-[10px] text-muted-foreground">
          <span>{formatCompact(max)}</span>
          <span>{formatCompact(max / 2)}</span>
          <span>0</span>
        </div>
        <div className="relative flex-1 border-b border-l">
          <div className="absolute inset-x-0 top-1/2 border-t border-dashed" />
          <div className="absolute inset-0 flex items-end gap-1 px-1">
            {MOIS.map((m, i) => (
              <div key={m} className="flex h-full flex-1 items-end justify-center gap-0.5">
                {series.map((s) => {
                  const v = s.values[i] ?? 0;
                  return (
                    <div
                      key={s.label}
                      title={`${s.label} — ${m} : ${formatAr(v)}`}
                      className={cn("w-full max-w-5 rounded-t", s.className)}
                      style={{ height: `${v > 0 ? Math.max(1.5, (v / max) * 100) : 0}%` }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="ml-14 flex gap-1 px-1 pt-1">
        {MOIS.map((m) => (
          <span key={m} className="flex-1 text-center text-[10px] text-muted-foreground">{m}</span>
        ))}
      </div>
    </div>
  );
}

export interface ItemBarre {
  cle: string;
  label: ReactNode;
  valeur: number;
  detail?: string;
  className?: string;
}

/** Barres horizontales proportionnelles au plus grand élément. */
export function BarresHorizontales({
  items, formatValeur = formatAr, vide = "Aucune donnée.",
}: {
  items: ItemBarre[];
  formatValeur?: (n: number) => string;
  vide?: string;
}) {
  if (items.length === 0 || items.every((i) => i.valeur === 0)) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{vide}</p>;
  }
  const max = Math.max(1, ...items.map((i) => i.valeur));
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.cle} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{i.label}</span>
            <span className="shrink-0 font-medium tabular-nums">{formatValeur(i.valeur)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted" title={`${i.detail ?? ""} ${formatValeur(i.valeur)}`.trim()}>
            <div
              className={cn("h-full rounded-full", i.className ?? "bg-primary")}
              style={{ width: `${(i.valeur / max) * 100}%` }}
            />
          </div>
          {i.detail && <p className="text-xs text-muted-foreground">{i.detail}</p>}
        </li>
      ))}
    </ul>
  );
}

export function Kpi({
  label, valeur, sous, ton,
}: {
  label: string;
  valeur: string;
  sous?: ReactNode;
  ton?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", ton)}>{valeur}</p>
      {sous && <div className="mt-1 text-xs text-muted-foreground">{sous}</div>}
    </div>
  );
}

/** Évolution en % par rapport à l'année précédente. */
export function Variation({ actuel, precedent }: { actuel: number; precedent: number }) {
  if (precedent <= 0) return <span>Pas de référence pour l'année précédente</span>;
  const pct = ((actuel - precedent) / precedent) * 100;
  const hausse = pct >= 0;
  return (
    <span className={hausse ? "text-green-700" : "text-red-600"}>
      {hausse ? "▲" : "▼"} {formatNombre(Math.abs(Math.round(pct * 10) / 10))} % vs {` année précédente`}
    </span>
  );
}