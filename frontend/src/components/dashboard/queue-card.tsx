"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { estPrete } from "@/config/routes";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Paginated } from "@/types/api";
import type { QueueDef, QueueRow } from "./types";

export function QueueCard({ def }: { def: QueueDef }) {
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

  const lignes: QueueRow[] = (data ?? []).map(def.row);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">{def.title}</CardTitle>
        {def.href && estPrete(def.href) && (
          <Link href={def.href} className="text-xs text-muted-foreground hover:underline">
            Tout voir
          </Link>
        )}
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        )}
        {isError && <p className="py-4 text-center text-sm text-destructive">Chargement impossible.</p>}
        {!isLoading && !isError && lignes.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">{def.empty}</p>
        )}
        <ul className="divide-y">
          {lignes.map((r, i) => {
            const corps = (
              <div className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.titre}</p>
                  {r.detail && <p className="truncate text-xs text-muted-foreground">{r.detail}</p>}
                </div>
                {r.badge && <div className="shrink-0 text-sm">{r.badge}</div>}
              </div>
            );
            return (
              <li key={i}>
                {r.href && estPrete(r.href) ? (
                  <Link href={r.href} className="block rounded hover:bg-muted/50">{corps}</Link>
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