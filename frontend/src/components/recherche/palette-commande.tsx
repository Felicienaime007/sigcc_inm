"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Search, SearchX } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/kbd";
import { NAV } from "@/config/nav";
import { estPrete } from "@/config/routes";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/i18n/contexte";
import { cn } from "@/lib/utils";

function sansAccents(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

interface Entree {
  groupe: string;
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}

/** Palette de commande SaaS : recherche globale des pages (Ctrl+K), groupée par module. */
export function PaletteCommande({ ouvert, onOpenChange }: { ouvert: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useT();
  const { can, hasRole } = useAuth();
  const router = useRouter();
  const [filtre, setFiltre] = useState("");
  const [position, setPosition] = useState(0);
  const champ = useRef<HTMLInputElement>(null);
  const listeRef = useRef<HTMLUListElement>(null);

  const groupes = useMemo<{ groupe: string; entrees: Entree[] }[]>(() => {
    const estAdmin = hasRole("ADMIN");
    return NAV.map((g) => ({
      groupe: t(g.label),
      entrees: g.items
        .filter((item) => {
          if (item.privilege && !can(item.privilege)) return false;
          if (!item.roles || item.roles.length === 0) return true;
          if (estAdmin) return true;
          return item.roles.some((r) => hasRole(r));
        })
        .filter((item) => estPrete(item.href))
        .map((item) => ({ groupe: t(g.label), href: item.href, label: t(item.label), Icon: item.icon })),
    })).filter((g) => g.entrees.length > 0);
  }, [can, hasRole, t]);

  const resultats = useMemo(() => {
    const f = sansAccents(filtre.trim());
    if (!f) return groupes;
    return groupes
      .map((g) => ({
        groupe: g.groupe,
        entrees: g.entrees.filter(
          (e) => sansAccents(e.label).includes(f) || sansAccents(e.groupe).includes(f),
        ),
      }))
      .filter((g) => g.entrees.length > 0);
  }, [groupes, filtre]);

  const aplat = useMemo(() => resultats.flatMap((g) => g.entrees), [resultats]);
  const total = groupes.reduce((s, g) => s + g.entrees.length, 0);
  // Index global de chaque groupe pour la navigation clavier (sans mutation au rendu).
  const offsets = useMemo(() => {
    const map = new Map<string, number>();
    let acc = 0;
    for (const g of resultats) {
      map.set(g.groupe, acc);
      acc += g.entrees.length;
    }
    return map;
  }, [resultats]);

  useEffect(() => {
    if (ouvert) {
      setFiltre("");
      setPosition(0);
      const id = window.setTimeout(() => champ.current?.focus(), 30);
      return () => window.clearTimeout(id);
    }
  }, [ouvert]);

  useEffect(() => setPosition(0), [filtre]);

  // Maintient l'élément actif visible au clavier.
  useEffect(() => {
    listeRef.current?.querySelector('[data-actif="true"]')?.scrollIntoView({ block: "nearest" });
  }, [position]);

  function aller(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  function onTouche(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setPosition((p) => Math.min(p + 1, aplat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setPosition((p) => Math.max(p - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cible = aplat[position];
      if (cible) aller(cible.href);
    }
  }

  return (    <Dialog open={ouvert} onOpenChange={onOpenChange}>
      <DialogContent className="top-[14%] max-w-lg translate-y-0 gap-0 overflow-hidden rounded-2xl p-0 shadow-2xl">
        <DialogTitle className="sr-only">{t("recherche.titre")}</DialogTitle>
        <DialogDescription className="sr-only">{t("recherche.description")}</DialogDescription>
        <div className="flex items-center gap-2 border-b px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <Input
            ref={champ}
            value={filtre}
            onChange={(e) => setFiltre(e.target.value)}
            onKeyDown={onTouche}
            placeholder={t("recherche.placeholder")}
            aria-label={t("recherche.titre")}
            role="combobox"
            aria-expanded
            aria-controls="palette-liste"
            aria-activedescendant={aplat[position] ? `palette-${position}` : undefined}
            className="h-12 border-0 bg-transparent text-[15px] shadow-none focus-visible:ring-0"
          />
          {filtre ? (
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {aplat.length}/{total}
            </span>
          ) : (
            <Kbd>esc</Kbd>
          )}
        </div>
        <ul ref={listeRef} id="palette-liste" className="max-h-80 overflow-y-auto p-2" role="listbox" aria-label={t("recherche.titre")}>
          {aplat.length === 0 && (
            <li className="flex flex-col items-center px-3 py-10 text-center">
              <SearchX className="mb-2 h-6 w-6 text-muted-foreground/50" aria-hidden />
              <p className="text-sm font-medium">{t("recherche.vide")}</p>
            </li>
          )}
          {resultats.map((g) => (
            <li key={g.groupe}>
              <p className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                {g.groupe}
              </p>
              <ul className="space-y-0.5">
                {g.entrees.map((e, j) => {
                  const i = (offsets.get(g.groupe) ?? 0) + j;
                  const Icone = e.Icon;
                  const actif = i === position;
                  return (
                    <li key={`${e.href}-${e.label}`}>
                      <button
                        type="button"
                        id={`palette-${i}`}
                        role="option"
                        aria-selected={actif}
                        data-actif={actif}
                        onMouseMove={() => setPosition(i)}
                        onClick={() => aller(e.href)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm outline-none transition-colors",
                          actif ? "bg-accent text-accent-foreground" : "text-foreground/80",
                        )}
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Icone className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium">{e.label}</span>
                        <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-4 border-t bg-muted/40 px-4 py-2.5 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> {t("recherche.naviguer")}</span>
          <span className="flex items-center gap-1"><Kbd>↵</Kbd> {t("recherche.ouvrir")}</span>
          <span className="ml-auto hidden items-center gap-1 sm:flex"><Kbd>Ctrl</Kbd>+<Kbd>K</Kbd></span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
