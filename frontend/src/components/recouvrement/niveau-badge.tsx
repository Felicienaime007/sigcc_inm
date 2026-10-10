import { cn } from "@/lib/utils";

const STYLES: Record<number, string> = {
  1: "bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200",
  2: "bg-orange-100 text-orange-800",
  3: "bg-red-100 dark:bg-red-900/60 text-red-800 dark:text-red-200",
};
const COURTS: Record<number, string> = { 1: "Amiable", 2: "Relance ferme", 3: "Contentieux" };

export function NiveauBadge({ niveau }: { niveau: number }) {
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", STYLES[niveau] ?? "bg-muted")}>
      Niveau {niveau} · {COURTS[niveau] ?? ""}
    </span>
  );
}

/** Trois étapes : amiable → relance ferme → contentieux. */
export function NiveauSteps({ niveau }: { niveau: number }) {
  return (
    <ol className="flex items-center gap-2 text-xs">
      {[1, 2, 3].map((n) => (
        <li key={n} className="flex items-center gap-2">
          <span
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold",
              n <= niveau
                ? n === 3 ? "border-red-600 bg-red-600 text-white" : "border-primary bg-primary text-primary-foreground"
                : "text-muted-foreground",
            )}
          >
            {n}
          </span>
          <span className={n === niveau ? "font-medium" : "text-muted-foreground"}>{COURTS[n]}</span>
          {n < 3 && <span className="h-px w-6 bg-border" />}
        </li>
      ))}
    </ol>
  );
}