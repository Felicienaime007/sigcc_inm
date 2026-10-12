"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, SearchX, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
  disabled?: boolean;
}

function sansAccents(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Surligne la partie trouvée dans un libellé. */
function Surligner({ texte, recherche }: { texte: string; recherche: string }) {
  const f = sansAccents(recherche.trim());
  if (!f) return <>{texte}</>;
  const idx = sansAccents(texte).indexOf(f);
  if (idx < 0) return <>{texte}</>;
  return (
    <>
      {texte.slice(0, idx)}
      <mark className="rounded-sm bg-[#e8b04a]/40 px-0 text-inherit">
        {texte.slice(idx, idx + recherche.trim().length)}
      </mark>
      {texte.slice(idx + recherche.trim().length)}
    </>
  );
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string | null | undefined;
  onChange: (valeur: string | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  id?: string;
  /** Bouton d'effacement quand une valeur est choisie (défaut : oui). */
  allowClear?: boolean;
}

/**
 * Liste déroulante : boutons radio simples jusqu'à 8 options, recherche
 * intégrée au-delà. Navigation clavier (flèches + Entrée + Échap),
 * surlignage du texte trouvé, état « aucun résultat ».
 */
export function Combobox({
  options, value, onChange,
  placeholder = "Choisir…",
  searchPlaceholder = "Rechercher…",
  emptyMessage = "Aucun résultat.",
  disabled, id, allowClear = true,
}: ComboboxProps) {
  const [ouvert, setOuvert] = useState(false);
  const [filtre, setFiltre] = useState("");
  const [position, setPosition] = useState(0);
  const baseId = useId();
  const champRef = useRef<HTMLInputElement>(null);
  const avecRecherche = options.length > 8;

  const filtrees = useMemo(() => {
    const f = sansAccents(filtre.trim());
    if (!f) return options;
    return options.filter((o) => sansAccents(o.label).includes(f));
  }, [options, filtre]);

  const selection = options.find((o) => o.value === value) ?? null;

  useEffect(() => {
    if (ouvert) {
      setFiltre("");
      setPosition(0);
      if (avecRecherche) {
        const t = window.setTimeout(() => champRef.current?.focus(), 30);
        return () => window.clearTimeout(t);
      }
    }
  }, [ouvert, avecRecherche]);

  useEffect(() => setPosition(0), [filtre]);

  function choisir(v: string | null) {
    onChange(v);
    setOuvert(false);
  }

  function onTouche(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setPosition((p) => Math.min(p + 1, Math.max(0, filtrees.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setPosition((p) => Math.max(p - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cible = filtrees[position];
      if (cible && !cible.disabled) choisir(cible.value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOuvert(false);
    }
  }

  return (
    <span className="relative block" onKeyDown={onTouche}>
      <span className="flex gap-1.5">
        <button
          type="button"
          id={id}
          disabled={disabled}
          onClick={() => setOuvert((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={ouvert}
          className={cn(
            "flex h-10 min-w-0 flex-1 items-center justify-between gap-2 rounded-[10px] border border-input bg-transparent px-3 text-sm shadow-xs transition-[border-color,box-shadow] outline-none hover:border-muted-foreground/35 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
            !selection && "text-muted-foreground",
          )}
        >
          <span className="min-w-0 flex-1 truncate text-left">
            {selection ? selection.label : placeholder}
          </span>
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", ouvert && "rotate-180")} aria-hidden />
        </button>
        {allowClear && selection && !disabled && (
          <button
            type="button"
            onClick={() => choisir(null)}
            aria-label={`Effacer la sélection (${selection.label})`}
            title="Effacer la sélection"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-input text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </span>
      {ouvert && (
        <>
          <span
            aria-hidden
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOuvert(false)}
          />
          <span className="absolute z-20 mt-1.5 block w-full overflow-hidden rounded-[10px] border bg-popover shadow-lg ring-1 ring-foreground/10">
            {avecRecherche && (
              <span className="flex items-center gap-2 border-b px-3">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <Input
                  ref={champRef}
                  value={filtre}
                  onChange={(e) => setFiltre(e.target.value)}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  role="combobox"
                  aria-expanded
                  aria-controls={`${baseId}-liste`}
                  aria-activedescendant={filtrees[position] ? `${baseId}-${position}` : undefined}
                  className="h-10 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
                />
              </span>
            )}
            <ul
              id={`${baseId}-liste`}
              role="listbox"
              aria-label={placeholder}
              className="max-h-64 overflow-y-auto p-1.5"
            >
              {filtrees.length === 0 && (
                <li className="flex flex-col items-center px-3 py-6 text-center">
                  <SearchX className="mb-1.5 h-5 w-5 text-muted-foreground/50" aria-hidden />
                  <p className="text-[13px] text-muted-foreground">{emptyMessage}</p>
                </li>
              )}
              {filtrees.map((o, i) => {
                const actif = i === position;
                const coche = o.value === value;
                return (
                  <li key={o.value} id={`${baseId}-${i}`} role="option" aria-selected={coche}>
                    <button
                      type="button"
                      disabled={o.disabled}
                      onMouseMove={() => setPosition(i)}
                      onClick={() => choisir(o.value)}
                      data-actif={actif}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm outline-none transition-colors disabled:opacity-50",
                        actif ? "bg-accent text-accent-foreground" : "text-foreground/85",
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        <Surligner texte={o.label} recherche={avecRecherche ? filtre : ""} />
                      </span>
                      {coche && <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </span>
        </>
      )}
    </span>
  );
}
