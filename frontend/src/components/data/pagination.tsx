"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/contexte";

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
      <div className="flex items-center gap-2">
        <Button
          variant="outline" size="sm"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label={t("commun.precedent")}
        >
          <ChevronLeft className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">{t("commun.precedent")}</span>
        </Button>
        <span className="min-w-20 text-center text-[13px] text-muted-foreground tabular-nums" aria-live="polite">
          {t("commun.page", { page, pages })}
        </span>
        <Button
          variant="outline" size="sm"
          disabled={disabled || page >= pages}
          onClick={() => onPageChange(page + 1)}
          aria-label={t("commun.suivant")}
        >
          <span className="hidden sm:inline">{t("commun.suivant")}</span>
          <ChevronRight className="h-4 w-4 sm:ml-1" />
        </Button>
      </div>
    </div>
  );
}
