"use client";

import { useState } from "react";
import { Search, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/use-debounce";
import { useList, type Params } from "@/lib/resource";
import { useT } from "@/lib/i18n/contexte";
import { TypeBadge } from "@/components/clients/type-badge";
import type { Client, TypeClient } from "@/types/clients";

/** Recherche de client à la saisie (les clients sont trop nombreux pour une liste déroulante). */
export function ClientSearch({
  value, onChange, params, exclureTypes, disabled,
}: {
  value: Client | null;
  onChange: (client: Client | null) => void;
  params?: Params;          // ex. { type_client: "SIMPLE" }
  /** Types à ne jamais proposer (ex. ["SIMPLE"] dans le circuit commercial). */
  exclureTypes?: TypeClient[];
  disabled?: boolean;
}) {
  const [saisie, setSaisie] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const { t } = useT();
  const recherche = useDebounce(saisie, 300);
  const { data, isFetching } = useList<Client>(
    "clients/clients",
    { search: recherche, page_size: 8, ordering: "nom_client", ...params },
    ouvert && !value,
  );
  // Garde-fou côté liste : le backend filtre déjà par rôle, mais un ADMIN voit
  // tous les types — on exclut ici les types interdits par le contexte (ex. SIMPLE hors comptoir).
  const resultats = (data?.results ?? []).filter((c) => !exclureTypes?.includes(c.type_client));

  function choisir(c: Client) {
    if (exclureTypes?.includes(c.type_client)) return;
    onChange(c);
    setSaisie("");
  }

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 p-3">
        <div className="flex items-center gap-3">
          <UserRound className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">{value.nom_client}</p>
            <p className="text-xs text-muted-foreground">
              {[value.ville ?? value.localisation, value.telephone, value.cin_ou_nif].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        {!disabled && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            <X className="mr-1 h-4 w-4" /> {t("clients.rech.changer")}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        value={saisie}
        onChange={(e) => setSaisie(e.target.value)}
        onFocus={() => setOuvert(true)}
        onBlur={() => setTimeout(() => setOuvert(false), 150)}
        placeholder={t("clients.rech.placeholder")}
        className="pl-8"
        disabled={disabled}
      />
      {ouvert && (
        <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border bg-popover shadow-md">
          {isFetching && <p className="p-3 text-sm text-muted-foreground">{t("clients.rech.recherche")}</p>}
          {!isFetching && resultats.length === 0 && (
            <p className="p-3 text-sm text-muted-foreground">{t("clients.rech.aucun")}</p>
          )}
          {resultats.map((c) => (
            <button
              key={c.id_client}
              type="button"
              onMouseDown={() => choisir(c)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{c.nom_client}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {[c.ville ?? c.localisation, c.telephone, c.cin_ou_nif].filter(Boolean).join(" · ") || t("clients.rech.sans_detail")}
                </span>
              </span>
              <TypeBadge type={c.type_client} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}