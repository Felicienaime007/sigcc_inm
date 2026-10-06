"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  return (
    <Select value={value || TOUS} onValueChange={(v) => onChange(v === null || v === TOUS ? "" : v)}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={TOUS}>{label} : tous</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}