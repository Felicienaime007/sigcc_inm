"use client";

import { Input } from "@/components/ui/input";

/** Filtre « du … au … » (valeurs AAAA-MM-JJ, chaîne vide = pas de borne). */
export function DateRange({
  du, au, onChange,
}: {
  du: string;
  au: string;
  onChange: (cle: "du" | "au", valeur: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span>Du</span>
      <Input type="date" value={du} max={au || undefined} onChange={(e) => onChange("du", e.target.value)} className="w-40" />
      <span>au</span>
      <Input type="date" value={au} min={du || undefined} onChange={(e) => onChange("au", e.target.value)} className="w-40" />
    </div>
  );
}