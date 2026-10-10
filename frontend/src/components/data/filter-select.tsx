"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  return (
    <Select
      value={value || TOUS}
      onValueChange={(v) => onChange(v === null || v === TOUS ? "" : v)}
      items={{ [TOUS]: tous, ...Object.fromEntries(options.map((o) => [o.value, o.label])) }}
    >
      <SelectTrigger className={className}>
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