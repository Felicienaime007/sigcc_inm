"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/contexte";

const TOUS = "__tous__";

export interface FilterOption {
  value: string;
  label: string;
}

/** Filtre à choix fixes (statut, type...). `value` vaut "" quand « Tous » est choisi. */
export function FilterSelect({
  value, onChange, options, label, className = "w-44",
}: {
  value: string;
  onChange: (v: string) => void;
  options: FilterOption[];
  label: string;
  className?: string;
}) {
  const { t } = useT();
  const tous = t("commun.tous", { label });
  const actif = value !== "";
  return (
    <Select
      value={value || TOUS}
      onValueChange={(v) => onChange(v === null || v === TOUS ? "" : v)}
      items={{ [TOUS]: tous, ...Object.fromEntries(options.map((o) => [o.value, o.label])) }}
    >
      <SelectTrigger
        className={cn(
          className,
          "bg-muted/40 shadow-xs",
          actif && "border-primary/50 bg-primary/[0.07] text-foreground",
        )}
      >
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={TOUS}>{tous}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}