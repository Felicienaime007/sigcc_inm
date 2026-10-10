"use client";

import { Badge } from "@/components/ui/badge";
import { estSoa } from "@/lib/clients";
import { useT } from "@/lib/i18n/contexte";

export function TypeBadge({ type }: { type: string }) {
  const { t } = useT();
  const libelles: Record<string, string> = {
    MINISTERE: t("clients.types.ministere"),
    CTD: t("clients.types.ctd"),
    PRIVE: t("clients.types.prive"),
    SIMPLE: t("clients.types.simple"),
  };
  return <Badge variant={estSoa(type) ? "secondary" : "outline"}>{libelles[type] ?? type}</Badge>;
}
