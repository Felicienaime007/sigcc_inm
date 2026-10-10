"use client";

import { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchInput } from "@/components/data/search-input";
import { grouperPrivileges, libelleAction } from "@/lib/rbac";
import type { Privilege } from "@/types/users";
import { useT } from "@/lib/i18n/contexte";

/** Grille de cases à cocher groupée par module, avec « tout cocher » et recherche. */
export function PrivilegePicker({
  privileges, value, onChange, disabled,
}: {
  privileges: Privilege[];
  value: number[];
  onChange: (ids: number[]) => void;
  disabled?: boolean;
}) {
  const { t } = useT();
  const [filtre, setFiltre] = useState("");
  const choisis = useMemo(() => new Set(value), [value]);

  const groupes = useMemo(() => {
    const f = filtre.trim().toLowerCase();
    const filtres = f
      ? privileges.filter(
          (p) => p.code_action.toLowerCase().includes(f) || (p.description ?? "").toLowerCase().includes(f),
        )
      : privileges;
    return grouperPrivileges(filtres);
  }, [privileges, filtre]);

  function basculer(ids: number[], cocher: boolean) {
    const suite = new Set(choisis);
    ids.forEach((id) => (cocher ? suite.add(id) : suite.delete(id)));
    onChange([...suite]);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <SearchInput value={filtre} onChange={setFiltre} placeholder={t("admin.privileges.filtrer")} />
        <span className="shrink-0 text-xs text-muted-foreground">
          {t("admin.privileges.compte", { n: value.length, total: privileges.length })}
        </span>
      </div>

      <div className="max-h-96 space-y-3 overflow-y-auto rounded-md border p-3">
        {groupes.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("admin.privileges.vide")}</p>
        )}
        {groupes.map((g) => {
          const ids = g.items.map((p) => p.id_privilege);
          const nb = ids.filter((id) => choisis.has(id)).length;
          return (
            <div key={g.module}>
              <label className="flex items-center gap-2 text-sm font-medium">
                <Checkbox
                  disabled={disabled}
                  checked={nb === ids.length}
                  indeterminate={nb > 0 && nb < ids.length}
                  onCheckedChange={(c) => basculer(ids, c === true)}
                />
                {t(g.label)}
                <span className="text-xs font-normal text-muted-foreground">
                  ({nb}/{ids.length})
                </span>
              </label>
              <div className="ml-6 mt-1 flex flex-wrap gap-x-5 gap-y-1">
                {g.items.map((p) => (
                  <label
                    key={p.id_privilege}
                    title={p.description ?? p.code_action}
                    className="flex items-center gap-1.5 text-sm"
                  >
                    <Checkbox
                      disabled={disabled}
                      checked={choisis.has(p.id_privilege)}
                      onCheckedChange={(c) => basculer([p.id_privilege], c === true)}
                    />
                    {t(libelleAction(p.code_action))}
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}