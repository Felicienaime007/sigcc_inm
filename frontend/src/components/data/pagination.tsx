"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/contexte";
import { cn } from "@/lib/utils";

/** Fenêtre de pages façon SaaS : 1 … [p-1 p p+1] … N. */
function fenetre(page: number, pages: number): (number | "…")[] {
  const gardées = new Set(
    [1, 2, page - 1, page, page + 1, pages - 1, pages].filter((p) => p >= 1 && p <= pages),
  );
  const triées = [...gardées].sort((a, b) => a - b);
  const sortie: (number | "…")[] = [];
  let precedent = 0;
  for (const p of triées) {
    if (p - precedent > 1) sortie.push("…");
    sortie.push(p);
    precedent = p;
  }
  return sortie;
}

export function Pagination({
  page, pageSize, count, onPageChange, disabled,
}: {
  page: number;
  pageSize: number;
  count: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}) {
  const { t } = useT();
  const pages = Math.max(1, Math.ceil(count / pageSize));
  const debut = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const fin = Math.min(page * pageSize, count);

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-3 text-sm">
      <span className="text-[13px] text-muted-foreground tabular-nums">
        {count === 0 ? t("commun.aucun_resultat") : t("commun.resultats", { debut, fin, count })}
      </span>
      <nav aria-label={t("commun.page", { page, pages })} className="flex items-center gap-1">
        <Button
          variant="ghost" size="sm"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label={t("commun.precedent")}
          className="px-2"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden lg:inline">{t("commun.precedent")}</span>
        </Button>
        <span className="hidden items-center gap-1 sm:flex" role="list">
          {fenetre(page, pages).map((p, i) =>
            p === "…" ? (
              <span key={`e-${i}`} aria-hidden className="px-1 text-muted-foreground/60">…</span>
            ) : (
              <Button
                key={p}
                role="listitem"
                variant={p === page ? "default" : "ghost"}
                size="sm"
                disabled={disabled}
                aria-label={t("commun.page", { page: p, pages })}
                aria-current={p === page ? "page" : undefined}
                onClick={() => onPageChange(p)}
                className={cn("min-w-7 px-1.5 tabular-nums", p !== page && "text-muted-foreground")}
              >
                {p}
              </Button>
            ),
          )}
        </span>
        <span className="min-w-20 text-center text-[13px] text-muted-foreground tabular-nums sm:hidden" aria-live="polite">
          {t("commun.page", { page, pages })}
        </span>
        <Button
          variant="ghost" size="sm"
          disabled={disabled || page >= pages}
          onClick={() => onPageChange(page + 1)}
          aria-label={t("commun.suivant")}
          className="px-2"
        >
          <span className="hidden lg:inline">{t("commun.suivant")}</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </nav>
    </div>
  );
}
