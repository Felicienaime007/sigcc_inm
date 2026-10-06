"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { RemoteSelect } from "@/components/data/remote-select";
import { api } from "@/lib/api";
import { LEVELS } from "@/lib/territoire";
import { cn } from "@/lib/utils";

type Sel = (number | null)[];
type Item = Record<string, string | number>;

/** Remonte la chaîne des parents d'un élément : [province, région, district, ...]. */
async function chaine(upTo: number, id: number): Promise<Sel> {
  const ids: Sel = Array(upTo + 1).fill(null);
  ids[upTo] = id;
  for (let i = upTo; i > 0; i--) {
    const { data } = await api.get<Item>(`/${LEVELS[i].path}/${ids[i]}/`);
    ids[i - 1] = Number(data[LEVELS[i].parentField as string]);
  }
  return ids;
}

interface Props {
  /** Indice du niveau le plus bas à choisir : 0 province, 1 région, 2 district, 3 commune. */
  upTo: number;
  /** Mode formulaire : identifiant du niveau `upTo` (les niveaux supérieurs sont retrouvés seuls). */
  value?: number | null;
  onChange?: (id: number | null) => void;
  /** Mode filtre : reçoit la sélection de tous les niveaux à chaque changement. */
  onSelectionChange?: (sel: Sel) => void;
  allowEmpty?: boolean;
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
  itemClassName?: string;
}

export function HierarchyPicker({
  upTo, value, onChange, onSelectionChange, allowEmpty = false, emptyLabel,
  disabled, className, itemClassName,
}: Props) {
  const [sel, setSel] = useState<Sel>(() => Array(upTo + 1).fill(null));

  // Édition : retrouve les parents d'une valeur existante
  const chain = useQuery({
    queryKey: ["territoire-chaine", upTo, value],
    queryFn: () => chaine(upTo, value as number),
    enabled: value !== null && value !== undefined,
    staleTime: 60_000,
  });

  // Synchro légitime avec un système externe (chaîne des parents venue de l'API).
  useEffect(() => {
    if (value === undefined) return; // mode filtre : état local uniquement
    if (value === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSel(Array(upTo + 1).fill(null));
      return;
    }
    if (chain.data) setSel(chain.data);
  }, [value, chain.data, upTo]);

  function choisir(i: number, id: number | null) {
    // Changer un niveau remet à zéro tous les niveaux inférieurs
    const suite: Sel = [...sel.slice(0, i), id, ...Array(upTo - i).fill(null)];
    setSel(suite);
    onSelectionChange?.(suite);
    if (value !== undefined) onChange?.(suite[upTo]);
  }

  return (
    <div className={cn("grid gap-3 sm:grid-cols-2", className)}>
      {LEVELS.slice(0, upTo + 1).map((niveau, i) => (
        <div key={niveau.key} className={cn("space-y-1.5", itemClassName)}>
          <Label className="text-xs text-muted-foreground">{niveau.label}</Label>
          <RemoteSelect<Item>
            path={niveau.path}
            params={i > 0 ? { [LEVELS[i].parentField as string]: sel[i - 1] } : undefined}
            value={sel[i]}
            onChange={(id) => choisir(i, id)}
            getValue={(x) => Number(x[niveau.idKey])}
            getLabel={(x) => String(x[niveau.nameKey])}
            allowEmpty={allowEmpty}
            emptyLabel={emptyLabel}
            placeholder={`Choisir…`}
            disabled={disabled || (i > 0 && sel[i - 1] === null)}
          />
        </div>
      ))}
    </div>
  );
}