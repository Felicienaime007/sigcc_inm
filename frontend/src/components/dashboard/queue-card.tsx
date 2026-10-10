"use client";

import Link from "next/link";
import { createElement } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight, ChevronRight, Inbox, ListChecks, PackageCheck, Receipt,
  ScrollText, ShoppingCart, AlertTriangle, Factory,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { estPrete } from "@/config/routes";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/i18n/contexte";
import type { Paginated } from "@/types/api";
import type { QueueDef, QueueRow } from "./types";

/** Icône de la file selon sa source, pour une lecture immédiate. */
function iconeFile(path: string): LucideIcon {
  if (path.includes("factures")) return Receipt;
  if (path.includes("preparations")) return PackageCheck;
  if (path.includes("commandes")) return ShoppingCart;
  if (path.includes("lots")) return Factory;
  if (path.includes("impayes")) return AlertTriangle;
  if (path.includes("journal")) return ScrollText;
  return ListChecks;
}

export function QueueCard({ def }: { def: QueueDef }) {
  const { t } = useT();
  const { can } = useAuth();
  const autorise = can(def.privilege);
  const limit = def.limit ?? 6;
  const params = def.params?.() ?? {};

  const { data, isLoading, isError } = useQuery({
    queryKey: [def.path, "queue", params, limit],
    enabled: autorise,
    refetchInterval: def.live ? 8_000 : 30_000,
    queryFn: async (): Promise<unknown[]> => {
      if (def.array) {
        const { data } = await api.get<unknown[]>(`/${def.path}/`, { params });
        return data.slice(0, limit);
      }
      const { data } = await api.get<Paginated<unknown>>(`/${def.path}/`, {
        params: { ...params, page_size: limit },
      });
      return data.results;
    },
  });

  if (!autorise) return null;

  const lignes: QueueRow[] = (data ?? []).map((x) => def.row(x, t));
  const toutVoir = def.href && estPrete(def.href);

  return (
    <Card className="overflow-hidden shadow-[0_1px_2px_rgb(0_0_0/0.05)]">
      <CardHeader className="flex flex-row items-center gap-2.5 space-y-0 border-b bg-muted/40 px-4 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {createElement(iconeFile(def.path), { className: "h-4 w-4", "aria-hidden": true })}
        </span>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight">{def.title}</p>
        {lignes.length > 0 && (
          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary tabular-nums">
            {lignes.length}
          </span>
        )}
        {toutVoir && (
          <Link
            href={def.href!}
            className="group/voir flex shrink-0 items-center gap-0.5 rounded-md text-xs font-medium text-muted-foreground transition-colors outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("dash.tout_voir")}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/voir:translate-x-0.5" />
          </Link>
        )}
      </CardHeader>
      <CardContent className="px-2 py-1.5">
        {isLoading && (
          <div className="space-y-2 px-3 py-3" aria-label={t("commun.chargement")}>
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-11 w-full rounded-lg" />)}
          </div>
        )}
        {isError && (
          <EmptyState
            icon={AlertTriangle}
            title={t("dash.file.chargement")}
            description={t("commun.verifiez_connexion")}
            compact
          />
        )}
        {!isLoading && !isError && lignes.length === 0 && (
          <EmptyState icon={Inbox} title={def.empty} compact />
        )}
        <ul className="divide-y divide-border/60">
          {lignes.map((r, i) => {
            const corps = (
              <div className="group/ligne flex items-center justify-between gap-3 rounded-lg px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.titre}</p>
                  {r.detail && <p className="truncate text-xs text-muted-foreground">{r.detail}</p>}
                </div>
                {r.badge && <div className="shrink-0 text-sm">{r.badge}</div>}
                {r.href && estPrete(r.href) && (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-all group-hover/ligne:translate-x-0.5 group-hover/ligne:text-primary" />
                )}
              </div>
            );
            return (
              <li key={i}>
                {r.href && estPrete(r.href) ? (
                  <Link href={r.href} className="block transition-colors hover:bg-primary/[0.04]">{corps}</Link>
                ) : (
                  corps
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
