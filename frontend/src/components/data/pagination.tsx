"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Pagination({
  page, pageSize, count, onPageChange, disabled,
}: {
  page: number;
  pageSize: number;
  count: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  const debut = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const fin = Math.min(page * pageSize, count);

  return (
    <div className="flex items-center justify-between gap-3 py-3 text-sm">
      <span className="text-muted-foreground">
        {count === 0 ? "Aucun résultat" : `${debut}–${fin} sur ${count}`}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline" size="sm"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="mr-1 h-4 w-4" /> Précédent
        </Button>
        <span className="tabular-nums">
          Page {page} / {pages}
        </span>
        <Button
          variant="outline" size="sm"
          disabled={disabled || page >= pages}
          onClick={() => onPageChange(page + 1)}
        >
          Suivant <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}