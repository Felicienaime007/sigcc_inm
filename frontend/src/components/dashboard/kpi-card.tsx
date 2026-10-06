"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { estPrete } from "@/config/routes";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatAr, formatNombre } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Paginated } from "@/types/api";
import type { KpiDef } from "./types";

const COULEURS = {
  neutre: "",
  attention: "text-amber-600",
  danger: "text-red-600",
  succes: "text-green-600",
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

  const contenu = (
    <Card className={cn("h-full transition-colors", def.href && estPrete(def.href) && "hover:bg-muted/50")}>
      <CardContent className="space-y-1 pt-6">
        <p className="text-sm text-muted-foreground">{def.label}</p>
        {isLoading ? (
          <Skeleton className="h-8 w-24" />
        ) : isError || data === undefined ? (
          <p className="text-2xl font-semibold text-muted-foreground">—</p>
        ) : (
          <p className={cn("text-2xl font-semibold tabular-nums", data > 0 && COULEURS[def.ton ?? "neutre"])}>
            {def.format === "ar" ? formatAr(data) : formatNombre(data)}
          </p>
        )}
      </CardContent>
    </Card>
  );

  return def.href && estPrete(def.href) ? (
    <Link href={def.href} className="block">{contenu}</Link>
  ) : (
    contenu
  );
}