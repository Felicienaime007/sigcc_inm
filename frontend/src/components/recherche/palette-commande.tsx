"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight, Banknote, FileText, LoaderCircle, Receipt, Search, SearchX,
  ShoppingCart, Store, type LucideIcon,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/kbd";
import { Surligner } from "@/components/data/surlignage";
import { NAV } from "@/config/nav";
import { estPrete } from "@/config/routes";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/i18n/contexte";
import { useDebounce } from "@/hooks/use-debounce";
import { useList } from "@/lib/resource";
import { formatAr } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Client } from "@/types/clients";
import type { Commande, Facture } from "@/types/commercial";

function sansAccents(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

interface Entree {
  cle: string;
  label: string;
  detail?: string;
  Icon: LucideIcon;
  executer: () => void;
}

interface Section {
  titre: string;
  entrees: Entree[];
  chargement?: boolean;
}

/**
 * Palette de commande : pages (filtrées par privilèges), clients, factures,
 * commandes (recherche API à partir de 2 lettres, 300 ms) et actions rapides.
 * Ouverture Ctrl+K / Cmd+K, navigation flèches + Entrée, surlignage du texte trouvé.
 */
export function PaletteCommande({ ouvert, onOpenChange }: { ouvert: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useT();
  const { can, hasRole } = useAuth();
  const router = useRouter();
  const [filtre, setFiltre] = useState("");
  const [position, setPosition] = useState(0);
  const champ = useRef<HTMLInputElement>(null);
  const listeRef = useRef<HTMLUListElement>(null);
  const recherche = useDebounce(filtre.trim(), 300);
  const interrogeApi = ouvert && recherche.length >= 2;

  // ── Pages (privilèges + rôles) ──────────────────────────────────────────
  const groupesPages = useMemo(() => {
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

  function aller(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  const pagesFiltrees = useMemo(() => {
    const f = sansAccents(recherche);
    if (!f) return groupesPages;
    return groupesPages
      .map((g) => ({
        groupe: g.groupe,
        entrees: g.entrees.filter(
          (e) => sansAccents(e.label).includes(f) || sansAccents(e.groupe).includes(f),
        ),
      }))
      .filter((g) => g.entrees.length > 0);
  }, [groupesPages, recherche]);

  // ── Actions rapides (privilèges) ────────────────────────────────────────
  const actionsRapides = useMemo<Entree[]>(() => {
    const f = sansAccents(recherche);
    const toutes: (Entree & { privilege: string | string[] })[] = [
      {
        cle: "action-comptoir", label: t("recherche.action_comptoir"), Icon: Store,
        privilege: "client_simple.create", executer: () => aller("/comptoir"),
      },
      {
        cle: "action-devis", label: t("recherche.action_devis"), Icon: FileText,
        privilege: "devis.create", executer: () => aller("/commercial/devis"),
      },
      {
        cle: "action-commande", label: t("recherche.action_commande"), Icon: ShoppingCart,
        privilege: "commande.create", executer: () => aller("/commercial/commandes"),
      },
      {
        cle: "action-encaisser", label: t("recherche.action_encaisser"), Icon: Banknote,
        privilege: "reglement.encaisser", executer: () => aller("/tresorerie/reglements"),
      },
    ];
    return toutes
      .filter((a) => can(a.privilege))
      .filter((a) => !f || sansAccents(a.label).includes(f));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [can, recherche, t]);

  // ── Recherche API : clients, factures, commandes ────────────────────────
  const voitClients = can(["client.view", "client_simple.view"]);
  const voitFactures = can("facture.view");
  const voitCommandes = can("commande.view");

  const clients = useList<Client>(
    "clients/clients",
    { search: recherche, page_size: 5, ordering: "nom_client" },
    interrogeApi && voitClients,
  );
  const factures = useList<Facture>(
    "commercial/factures",
    { search: recherche, page_size: 5, ordering: "-date_facture" },
    interrogeApi && voitFactures,
  );
  const commandes = useList<Commande>(
    "commercial/commandes",
    { search: recherche, page_size: 5, ordering: "-date_commande" },
    interrogeApi && voitCommandes,
  );

  // ── Sections unifiées + navigation clavier ──────────────────────────────
  const sections = useMemo<Section[]>(() => {
    const liste: Section[] = [];
    for (const g of pagesFiltrees) {
      if (g.entrees.length > 0) {
        liste.push({
          titre: g.groupe,
          entrees: g.entrees.map((e) => ({
            cle: `page-${e.href}`, label: e.label, Icon: e.Icon,
            executer: () => aller(e.href),
          })),
        });
      }
    }
    if (actionsRapides.length > 0) {
      liste.push({ titre: t("recherche.actions"), entrees: actionsRapides });
    }
    if (interrogeApi && voitClients && (clients.data?.results?.length || clients.isFetching)) {
      liste.push({
        titre: t("recherche.clients"),
        chargement: clients.isFetching,
        entrees: (clients.data?.results ?? []).map((c) => ({
          cle: `client-${c.id_client}`,
          label: c.nom_client,
          detail: [c.ville ?? c.localisation, c.telephone].filter(Boolean).join(" · "),
          Icon: Search,
          executer: () => aller(`/clients/${c.id_client}`),
        })),
      });
    }
    if (interrogeApi && voitFactures && (factures.data?.results?.length || factures.isFetching)) {
      liste.push({
        titre: t("recherche.factures"),
        chargement: factures.isFetching,
        entrees: (factures.data?.results ?? []).map((f) => ({
          cle: `facture-${f.id_facture}`,
          label: f.num_facture,
          detail: `${f.nom_client} · ${formatAr(f.reste_a_payer)}`,
          Icon: Receipt,
          executer: () => aller(`/commercial/factures/${f.id_facture}`),
        })),
      });
    }
    if (interrogeApi && voitCommandes && (commandes.data?.results?.length || commandes.isFetching)) {
      liste.push({
        titre: t("recherche.commandes"),
        chargement: commandes.isFetching,
        entrees: (commandes.data?.results ?? []).map((c) => ({
          cle: `commande-${c.id_commande}`,
          label: c.num_commande,
          detail: c.nom_client,
          Icon: ShoppingCart,
          executer: () => aller(`/commercial/commandes/${c.id_commande}`),
        })),
      });
    }
    return liste;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagesFiltrees, actionsRapides, interrogeApi, voitClients, voitFactures, voitCommandes, clients.data, clients.isFetching, factures.data, factures.isFetching, commandes.data, commandes.isFetching, t]);

  const aplat = useMemo(() => sections.flatMap((s) => s.entrees), [sections]);
  const totalPages = groupesPages.reduce((s, g) => s + g.entrees.length, 0);

  const offsets = useMemo(() => {
    const map = new Map<string, number>();
    let acc = 0;
    for (const s of sections) {
      map.set(s.titre, acc);
      acc += s.entrees.length;
    }
    return map;
  }, [sections]);

  useEffect(() => {
    if (ouvert) {
      setFiltre("");
      setPosition(0);
      const id = window.setTimeout(() => champ.current?.focus(), 30);
      return () => window.clearTimeout(id);
    }
  }, [ouvert]);

  useEffect(() => setPosition(0), [filtre]);

  // La liste raccourcit pendant la frappe : repositionne sur un index valide.
  useEffect(() => {
    setPosition((p) => Math.min(p, Math.max(0, aplat.length - 1)));
  }, [aplat.length]);

  // Maintient l'élément actif visible au clavier.
  useEffect(() => {
    listeRef.current?.querySelector('[data-actif="true"]')?.scrollIntoView({ block: "nearest" });
  }, [position]);

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
      if (cible) cible.executer();
    }
  }

  const vide = recherche !== "" && aplat.length === 0 && !clients.isFetching && !factures.isFetching && !commandes.isFetching;

  return (
    <Dialog open={ouvert} onOpenChange={onOpenChange}>
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
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums" role="status">
              {aplat.length}/{totalPages}
            </span>
          ) : (
            <Kbd>esc</Kbd>
          )}
        </div>
        <ul ref={listeRef} id="palette-liste" className="max-h-80 overflow-y-auto p-2" role="listbox" aria-label={t("recherche.titre")}>
          {vide && (
            <li className="flex flex-col items-center px-3 py-10 text-center">
              <SearchX className="mb-2 h-6 w-6 text-muted-foreground/50" aria-hidden />
              <p className="text-sm font-medium">{t("recherche.vide")}</p>
            </li>
          )}
          {!vide && recherche !== "" && recherche.length < 2 && (
            <li className="px-3 py-6 text-center text-[13px] text-muted-foreground">
              {t("recherche.continuer")}
            </li>
          )}
          {sections.map((s) => (
            <li key={s.titre}>
              <p className="flex items-center gap-1.5 px-3 pt-2 pb-1 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                {s.titre}
                {s.chargement && <LoaderCircle className="h-3 w-3 animate-spin" aria-hidden />}
              </p>
              <ul className="space-y-0.5">
                {s.entrees.map((e, j) => {
                  const i = (offsets.get(s.titre) ?? 0) + j;
                  const Icone = e.Icon;
                  const actif = i === position;
                  return (
                    <li key={e.cle}>
                      <button
                        type="button"
                        id={`palette-${i}`}
                        role="option"
                        aria-selected={actif}
                        data-actif={actif}
                        onMouseMove={() => setPosition(i)}
                        onClick={() => e.executer()}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm outline-none transition-colors",
                          actif ? "bg-accent text-accent-foreground" : "text-foreground/80",
                        )}
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Icone className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium">
                          <Surligner texte={e.label} recherche={recherche} />
                          {e.detail && (
                            <span className="block truncate text-xs font-normal text-muted-foreground">
                              <Surligner texte={e.detail} recherche={recherche} />
                            </span>
                          )}
                        </span>
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

/** Alias francophone conservé pour les imports existants. */
export const CommandPalette = PaletteCommande;
