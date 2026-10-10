"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Activity, AlertTriangle, Banknote, BookmarkCheck, CircleDollarSign,
  ClipboardCheck, ClipboardList, Factory, FileText, FolderOpen, Gavel, KeyRound,
  Landmark, Package, PackageCheck, Receipt, ScrollText, ShoppingCart,
  Store, Truck, UserCheck, UserCog, Users, UserX, Wallet,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { estPrete } from "@/config/routes";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatAr, formatNombre } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Paginated } from "@/types/api";
import type { KpiDef, Ton } from "./types";

type Accent = "blue" | "teal" | "violet" | "amber" | "red" | "green" | "gray";

const ACCENTS: Record<Accent, { barre: string; tuile: string }> = {
  blue: { barre: "bg-blue-500", tuile: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  teal: { barre: "bg-teal-600", tuile: "bg-teal-600/10 text-teal-700 dark:text-teal-400" },
  violet: { barre: "bg-violet-500", tuile: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  amber: { barre: "bg-amber-500", tuile: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  red: { barre: "bg-red-500", tuile: "bg-red-500/10 text-red-600 dark:text-red-400" },
  green: { barre: "bg-emerald-500", tuile: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  gray: { barre: "bg-slate-400", tuile: "bg-slate-500/10 text-slate-500 dark:text-slate-400" },
};

/** Icône + accent par indicateur (chemin + clé), pour une lecture immédiate du métier. */
const PAR_INDICATEUR: Record<string, { icon: LucideIcon; accent: Accent }> = {
  "commercial/commandes::brouillon": { icon: ClipboardList, accent: "amber" },
  "commercial/commandes::validees": { icon: ShoppingCart, accent: "blue" },
  "commercial/devis::devis": { icon: FileText, accent: "violet" },
  "budget/engagements::engagements": { icon: Landmark, accent: "teal" },
  "clients/clients::clients": { icon: Users, accent: "blue" },
  "clients/solvabilites::bloques": { icon: UserX, accent: "red" },
  "commercial/commandes::a-preparer": { icon: ClipboardCheck, accent: "amber" },
  "commercial/preparations::en-cours": { icon: PackageCheck, accent: "blue" },
  "commercial/preparations::pretes": { icon: Truck, accent: "green" },
  "commercial/factures::comptoir": { icon: Store, accent: "amber" },
  "stock/reservations::resa": { icon: BookmarkCheck, accent: "violet" },
  "commercial/factures::a-encaisser": { icon: Banknote, accent: "amber" },
  "commercial/factures::partielles": { icon: Wallet, accent: "blue" },
  "tresorerie/reglements::jour": { icon: Banknote, accent: "green" },
  "tresorerie/caisses::solde": { icon: Landmark, accent: "teal" },
  "tresorerie/caisses::caisses": { icon: Landmark, accent: "teal" },
  "commercial/factures::virements": { icon: Landmark, accent: "amber" },
  "commercial/commandes::a-facturer": { icon: Receipt, accent: "amber" },
  "commercial/commandes::commandes": { icon: ShoppingCart, accent: "teal" },
  "commercial/factures::non-payees": { icon: Receipt, accent: "amber" },
  "recouvrement/dossiers/impayes::echus": { icon: AlertTriangle, accent: "red" },
  "recouvrement/dossiers/impayes::montant": { icon: CircleDollarSign, accent: "red" },
  "recouvrement/dossiers::en-cours": { icon: FolderOpen, accent: "amber" },
  "recouvrement/dossiers::contentieux": { icon: Gavel, accent: "red" },
  "recouvrement/dossiers::dossiers": { icon: FolderOpen, accent: "blue" },
  "produits/lots::planifies": { icon: Factory, accent: "amber" },
  "produits/lots::en-cours": { icon: Factory, accent: "blue" },
  "produits/lots::lots": { icon: Factory, accent: "teal" },
  "commercial/preparations::preparations": { icon: PackageCheck, accent: "teal" },
  "produits::produits": { icon: Package, accent: "blue" },
  "users/utilisateurs::actifs": { icon: UserCheck, accent: "green" },
  "users/utilisateurs::inactifs": { icon: UserX, accent: "gray" },
  "users/utilisateurs::suspendus": { icon: UserCog, accent: "amber" },
  "users/roles::roles": { icon: KeyRound, accent: "violet" },
  "audit/journal::audit": { icon: ScrollText, accent: "teal" },
};

const ACCENT_PAR_TON: Record<Ton, Accent> = {
  neutre: "teal",
  attention: "amber",
  danger: "red",
  succes: "green",
};

const COULEURS_VALEUR = {
  neutre: "",
  attention: "text-amber-600 dark:text-amber-400",
  danger: "text-red-600 dark:text-red-400",
  succes: "text-green-600 dark:text-green-400",
} as const;

export function KpiCard({ def }: { def: KpiDef }) {
  const { can } = useAuth();
  const autorise = can(def.privilege);
  const agg = def.agg ?? { type: "count" as const };
  const params = def.params?.() ?? {};

  const { data, isLoading, isError } = useQuery({
    queryKey: [def.path, "kpi", params, agg],
    enabled: autorise,
    refetchInterval: def.live ? 8_000 : 30_000,
    queryFn: async (): Promise<number> => {
      if (agg.type === "length" || agg.type === "sumArray") {
        const { data } = await api.get<Record<string, string | number>[]>(`/${def.path}/`, { params });
        return agg.type === "length"
          ? data.length
          : data.reduce((s, r) => s + Number(r[agg.field] ?? 0), 0);
      }
      if (agg.type === "sum") {
        const { data } = await api.get<Paginated<Record<string, string | number>>>(`/${def.path}/`, {
          params: { ...params, page_size: 1000 },
        });
        return data.results.reduce((s, r) => s + Number(r[agg.field] ?? 0), 0);
      }
      const { data } = await api.get<Paginated<unknown>>(`/${def.path}/`, {
        params: { ...params, page_size: 1 },
      });
      return data.count;
    },
  });

  if (!autorise) return null;   // jamais de compteur qu'on ne pourrait pas ouvrir

  const style = PAR_INDICATEUR[`${def.path}::${def.key}`] ?? { icon: Activity, accent: ACCENT_PAR_TON[def.ton ?? "neutre"] };
  const accent = ACCENTS[style.accent];
  const Icone = style.icon;
  const cliquable = def.href && estPrete(def.href);

  const contenu = (
    <Card className="card-hover group relative h-full overflow-hidden shadow-[0_1px_2px_rgb(0_0_0/0.05)]">
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-[3px]", accent.barre)} />
      <CardContent className="flex items-start justify-between gap-3 p-4 pl-[18px]">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.04em] text-muted-foreground uppercase">
            {def.live && (
              <span className="relative flex h-1.5 w-1.5 shrink-0" title="Actualisation en direct">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
            )}
            <span className="truncate">{def.label}</span>
          </p>
          {isLoading ? (
            <Skeleton className="mt-2 h-7 w-20" />
          ) : isError || data === undefined ? (
            <p className="mt-1 text-[26px] leading-none font-bold tracking-tight text-muted-foreground tabular-nums">—</p>
          ) : (
            <p className={cn("mt-1 truncate text-[26px] leading-none font-bold tracking-tight tabular-nums", data > 0 && COULEURS_VALEUR[def.ton ?? "neutre"])}>
              {def.format === "ar" ? formatAr(data) : formatNombre(data)}
            </p>
          )}
        </div>
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105", accent.tuile)}>
          <Icone className="h-5 w-5" strokeWidth={1.9} aria-hidden />
        </span>
      </CardContent>
    </Card>
  );

  return cliquable ? (
    <Link href={def.href!} className="block h-full rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">{contenu}</Link>
  ) : (
    contenu
  );
}
