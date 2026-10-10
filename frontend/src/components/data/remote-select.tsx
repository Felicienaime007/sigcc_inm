"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOptions, type Params } from "@/lib/resource";
import { useT } from "@/lib/i18n/contexte";

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
  placeholder = "commun.selectionner", allowEmpty = false, emptyLabel = "commun.aucun", disabled,
}: Props<T>) {
  const { t } = useT();
  const { data, isLoading, isError } = useOptions<T>(path, params, !disabled);
  const libelleVide = t(emptyLabel);
  // Correspondance valeur → libellé pour l'affichage de la sélection : Base UI
  // ne retrouve le libellé que via `items` (les options démontées avec la
  // liste ne comptent pas) — sans ça, la sélection affiche l'id brut.
  const items: Record<string, string> = Object.fromEntries((data ?? []).map((item) => [String(getValue(item)), getLabel(item)]));
  if (allowEmpty) items[AUCUN] = libelleVide;

  return (
    <div>
      <Select
        value={value !== null && value !== undefined ? String(value) : ""}
        onValueChange={(v) => onChange(v === AUCUN ? null : Number(v))}
        disabled={disabled || isLoading}
        items={items}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={isLoading ? t("commun.chargement") : isError ? t("commun.erreur_courte") : t(placeholder)} />
        </SelectTrigger>
        <SelectContent>
          {allowEmpty && <SelectItem value={AUCUN}>{libelleVide}</SelectItem>}
          {data?.map((item: T) => (
            <SelectItem key={getValue(item)} value={String(getValue(item))}>
              {getLabel(item)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isError && !disabled && (
        <p className="mt-1 text-xs text-destructive">{t("commun.erreur_reouvrir")}</p>
      )}
    </div>
  );
}