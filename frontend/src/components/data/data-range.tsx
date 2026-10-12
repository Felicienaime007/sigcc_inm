"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Filtre « du … au … » (valeurs AAAA-MM-JJ, chaîne vide = pas de borne). */
export function DateRange({
  du, au, onChange,
}: {
  du: string;
  au: string;
  onChange: (cle: "du" | "au", valeur: string) => void;
}) {
  const actif = du !== "" || au !== "";
  const champ = cn(
    "h-9 w-40 bg-muted/40 shadow-xs",
    actif && "border-primary/50 bg-primary/[0.07]",
  );
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span>Du</span>
      <Input type="date" value={du} max={au || undefined} onChange={(e) => onChange("du", e.target.value)} className={champ} />
      <span>au</span>
      <Input type="date" value={au} min={du || undefined} onChange={(e) => onChange("au", e.target.value)} className={champ} />
    </div>
  );
}
