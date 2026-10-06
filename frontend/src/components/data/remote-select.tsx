"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOptions, type Params } from "@/lib/resource";

const AUCUN = "__aucun__";

interface Props<T> {
  path: string;                       // ex. "territoire/provinces"
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  getValue: (item: T) => number;      // ex. (p) => p.id_province
  getLabel: (item: T) => string;      // ex. (p) => p.nom_province
  params?: Params;                    // filtre, ex. { province: 3 } pour une liste en cascade
  placeholder?: string;
  allowEmpty?: boolean;               // ajoute une option vide (champ facultatif ou filtre)
  emptyLabel?: string;                // libellé de l'option vide
  disabled?: boolean;                 // désactivée = aucune requête envoyée
}

/** Liste déroulante alimentée par l'API (clé étrangère d'un formulaire). */
export function RemoteSelect<T>({
  path, value, onChange, getValue, getLabel, params,
  placeholder = "Sélectionner…", allowEmpty = false, emptyLabel = "— Aucun —", disabled,
}: Props<T>) {
  const { data, isLoading, isError } = useOptions<T>(path, params, !disabled);

  return (
    <div>
      <Select
        value={value !== null && value !== undefined ? String(value) : ""}
        onValueChange={(v) => onChange(v === AUCUN ? null : Number(v))}
        disabled={disabled || isLoading}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={isLoading ? "Chargement…" : isError ? "Chargement impossible" : placeholder} />
        </SelectTrigger>
        <SelectContent>
          {allowEmpty && <SelectItem value={AUCUN}>{emptyLabel}</SelectItem>}
          {data?.map((item: T) => (
            <SelectItem key={getValue(item)} value={String(getValue(item))}>
              {getLabel(item)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isError && !disabled && (
        <p className="mt-1 text-xs text-destructive">Chargement impossible. Vérifiez la connexion puis rouvrez.</p>
      )}
    </div>
  );
}