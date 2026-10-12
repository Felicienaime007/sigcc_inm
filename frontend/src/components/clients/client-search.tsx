"use client";

import { useMemo, useRef, useState } from "react";
import { Plus, Search, SearchX, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/use-debounce";
import { useList, type Params } from "@/lib/resource";
import { useT } from "@/lib/i18n/contexte";
import { TypeBadge } from "@/components/clients/type-badge";
import { Surligner } from "@/components/data/surlignage";
import { cn } from "@/lib/utils";
import type { Client, TypeClient } from "@/types/clients";

const ORDRE_TYPES: TypeClient[] = ["MINISTERE", "CTD", "PRIVE", "SIMPLE"];

/** Recherche de client à la saisie (les clients sont trop nombreux pour une liste déroulante). */
export function ClientSearch({
  value, onChange, params, exclureTypes, disabled, onCreate, createLabel, groupByType = true,
}: {
  value: Client | null;
  onChange: (client: Client | null) => void;
  params?: Params;          // ex. { type_client: "SIMPLE" }
  /** Types à ne jamais proposer (ex. ["SIMPLE"] dans le circuit commercial). */
  exclureTypes?: TypeClient[];
  disabled?: boolean;
  /** Création rapide : bouton en bas de liste avec la saisie courante. */
  onCreate?: (saisie: string) => void;
  /** Libellé du bouton de création (« {nom} » = saisie). */
  createLabel?: string;
  /** Regroupe les résultats par type de client (défaut : oui). */
  groupByType?: boolean;
}) {
  const [saisie, setSaisie] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const [position, setPosition] = useState(0);
  const { t } = useT();
  const listeRef = useRef<HTMLDivElement>(null);
  const recherche = useDebounce(saisie, 300);
  const { data, isFetching } = useList<Client>(
    "clients/clients",
    { search: recherche, page_size: 8, ordering: "nom_client", ...params },
    ouvert && !value,
  );
  // Garde-fou côté liste : le backend filtre déjà par rôle, mais un ADMIN voit
  // tous les types — on exclut ici les types interdits par le contexte (ex. SIMPLE hors comptoir).
  const resultats = (data?.results ?? []).filter((c) => !exclureTypes?.includes(c.type_client));

  const groupes = useMemo(() => {
    if (!groupByType) return [{ type: null as TypeClient | null, clients: resultats }];
    return ORDRE_TYPES.map((type) => ({
      type,
      clients: resultats.filter((c) => c.type_client === type),
    })).filter((g) => g.clients.length > 0);
  }, [resultats, groupByType]);

  const peutCreer = !!onCreate && saisie.trim().length >= 2;
  const plat: Client[] = useMemo(() => groupes.flatMap((g) => g.clients), [groupes]);
  // Index du bouton « créer » dans la navigation clavier (après le dernier résultat).
  const indexCreation = peutCreer ? plat.length : -1;
  const totalNavigable = plat.length + (peutCreer ? 1 : 0);

  function choisir(c: Client) {
    if (exclureTypes?.includes(c.type_client)) return;
    onChange(c);
    setSaisie("");
  }

  function creer() {
    if (!onCreate || !peutCreer) return;
    onCreate(saisie.trim());
    setSaisie("");
    setOuvert(false);
  }

  function defilerVersActif() {
    requestAnimationFrame(() => {
      listeRef.current?.querySelector('[data-actif="true"]')?.scrollIntoView({ block: "nearest" });
    });
  }

  function onTouche(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setPosition((p) => {
        const suivant = Math.min(p + 1, Math.max(0, totalNavigable - 1));
        return suivant;
      });
      defilerVersActif();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setPosition((p) => Math.max(p - 1, 0));
      defilerVersActif();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (position === indexCreation) creer();
      else {
        const cible = plat[position];
        if (cible) choisir(cible);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (saisie) setSaisie("");
      else setOuvert(false);
    }
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
      <Search className="pointer-events-none absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        value={saisie}
        onChange={(e) => { setSaisie(e.target.value); setPosition(0); }}
        onFocus={() => setOuvert(true)}
        onBlur={() => setTimeout(() => setOuvert(false), 150)}
        onKeyDown={onTouche}
        placeholder={t("clients.rech.placeholder")}
        role="combobox"
        aria-expanded={ouvert}
        aria-controls="client-search-liste"
        aria-activedescendant={position < plat.length ? `client-search-${position}` : position === indexCreation ? "client-search-creer" : undefined}
        aria-autocomplete="list"
        className="pl-8"
        disabled={disabled}
      />
      {ouvert && (
        <div
          ref={listeRef}
          id="client-search-liste"
          role="listbox"
          aria-label={t("clients.rech.placeholder")}
          className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border bg-popover shadow-md"
        >
          {isFetching && <p className="p-3 text-sm text-muted-foreground" role="status">{t("clients.rech.recherche")}</p>}
          {!isFetching && plat.length === 0 && !peutCreer && (
            <p className="flex flex-col items-center px-3 py-6 text-center">
              <SearchX className="mb-1.5 h-5 w-5 text-muted-foreground/50" aria-hidden />
              <span className="text-sm text-muted-foreground">{t("clients.rech.aucun")}</span>
            </p>
          )}
          {groupes.map((g) => (
            <div key={g.type ?? "tous"}>
              {groupByType && g.type && (
                <p className="px-3 pt-2 pb-0.5 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                  {t(`clients.types.${g.type.toLowerCase()}`)}
                </p>
              )}
              {g.clients.map((c) => {
                const i = plat.indexOf(c);
                const actif = i === position;
                return (
                  <button
                    key={c.id_client}
                    id={`client-search-${i}`}
                    type="button"
                    role="option"
                    aria-selected={actif}
                    data-actif={actif}
                    onMouseMove={() => setPosition(i)}
                    onMouseDown={() => choisir(c)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm outline-none transition-colors",
                      actif ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        <Surligner texte={c.nom_client} recherche={saisie} />
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[c.ville ?? c.localisation, c.telephone, c.cin_ou_nif].filter(Boolean).join(" · ") || t("clients.rech.sans_detail")}
                      </span>
                    </span>
                    <TypeBadge type={c.type_client} />
                  </button>
                );
              })}
            </div>
          ))}
          {peutCreer && (
            <button
              id="client-search-creer"
              type="button"
              role="option"
              aria-selected={position === indexCreation}
              data-actif={position === indexCreation}
              onMouseMove={() => setPosition(indexCreation)}
              onMouseDown={creer}
              className={cn(
                "flex w-full items-center gap-2 border-t px-3 py-2.5 text-left text-sm font-medium outline-none transition-colors",
                position === indexCreation ? "bg-accent text-accent-foreground" : "text-primary hover:bg-muted",
              )}
            >
              <Plus className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">
                {createLabel ?? t("clients.rech.creer", { nom: saisie.trim() })}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
