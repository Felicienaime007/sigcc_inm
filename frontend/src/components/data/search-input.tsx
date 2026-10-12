"use client";

import { useEffect, useRef } from "react";
import { LoaderCircle, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/kbd";
import { useT } from "@/lib/i18n/contexte";
import { cn } from "@/lib/utils";

/**
 * Recherche de tableau façon SaaS : barre haute avec anneau de focus,
 * raccourci « / » pour cibler, « Échap » pour effacer, bouton d'effacement.
 * L'attente de 300 ms est gérée par l'appelant (usePagedList / useDebounce) ;
 * `resultCount` affiche le compteur de résultats et `isLoading` un état
 * de chargement discret.
 */
export function SearchInput({
  value, onChange, placeholder, id, resultCount, isLoading,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id?: string;
  /** Nombre de résultats (compteur affiché quand une recherche est saisie). */
  resultCount?: number | null;
  /** Requête en cours : indicateur discret à la place du raccourci. */
  isLoading?: boolean;
}) {
  const { t } = useT();
  const champ = useRef<HTMLInputElement>(null);

  // Raccourci global « / » : cible la recherche (hors saisie en cours).
  useEffect(() => {
    function onTouche(e: KeyboardEvent) {
      const cible = e.target as HTMLElement | null;
      const enSaisie =
        !!cible &&
        (cible.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(cible.tagName));
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && !enSaisie) {
        e.preventDefault();
        champ.current?.focus();
        champ.current?.select();
      }
    }
    window.addEventListener("keydown", onTouche);
    return () => window.removeEventListener("keydown", onTouche);
  }, []);

  function onToucheChamp(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      if (value) onChange("");
      else champ.current?.blur();
    }
  }

  return (
    <div
      role="search"
      className="flex h-10 w-full max-w-sm items-center gap-2 rounded-lg border border-input bg-card pr-1.5 pl-3 shadow-xs transition-[border-color,box-shadow] hover:border-muted-foreground/35 focus-within:border-primary focus-within:shadow-sm"
    >
      <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <Input
        ref={champ}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onToucheChamp}
        placeholder={placeholder ?? t("commun.rechercher")}
        aria-label={placeholder ?? t("commun.rechercher")}
        className="h-full flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            onChange("");
            champ.current?.focus();
          }}
          aria-label={t("commun.annuler")}
          title={t("commun.annuler")}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      ) : isLoading ? (
        <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
      ) : (
        <Kbd aria-hidden>/</Kbd>
      )}
      {resultCount !== null && resultCount !== undefined && value.trim() !== "" && (
        <span
          role="status"
          aria-live="polite"
          className={cn(
            "shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
            "bg-primary/10 text-primary",
          )}
        >
          {resultCount}
        </span>
      )}
    </div>
  );
}
