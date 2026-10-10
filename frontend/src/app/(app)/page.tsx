"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { ShieldCheck } from "lucide-react";
import { RoleDashboard } from "@/components/dashboard/role-dashboard";
import { DASHBOARDS, ORDRE_ROLES } from "@/components/dashboard/role-dashboards";
import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/i18n/contexte";

function dateDuJour(langue: string): string {
  try {
    return new Intl.DateTimeFormat(langue === "mg" ? "mg-MG" : langue === "en" ? "en-GB" : "fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date());
  } catch {
    return "";
  }
}

export default function AccueilPage() {
  const { t, langue } = useT();
  const { user, hasRole } = useAuth();
  const [choix, setChoix] = useState<string | null>(null);
  if (!user) return null;

  // L'administrateur peut parcourir tous les espaces ; les autres voient ceux de leurs rôles
  const disponibles = ORDRE_ROLES.filter((r) => DASHBOARDS[r] && (hasRole("ADMIN") || user.roles.includes(r)));
  const actif = disponibles.find((r) => r === choix) ?? disponibles[0];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={dateDuJour(langue)}
        title={t("dash.bonjour", { nom: user.nom_complet })}
        description={
          disponibles.length > 0
            ? `Matricule ${user.matricule} · ${user.roles.join(", ")}`
            : `Matricule ${user.matricule}`
        }
      />

      {disponibles.length > 1 && (
        <Tabs value={actif} onValueChange={setChoix}>
          <TabsList className="h-auto max-w-full flex-wrap justify-start overflow-x-auto">
            {disponibles.map((r) => (
              <TabsTrigger key={r} value={r} className="shrink-0">{t(DASHBOARDS[r].titre)}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {actif ? (
        <RoleDashboard key={actif} def={DASHBOARDS[actif]} />
      ) : (
        // Rôle personnalisé sans espace dédié : on affiche simplement les droits accordés
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("dash.mes_privileges")}</CardTitle>
            <CardDescription>
              {t("dash.sans_espace")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {user.privileges.length === 0 ? (
              <EmptyState
                icon={ShieldCheck}
                title={t("dash.aucun_privilege")}
                compact
              />
            ) : (
              <div className="flex max-h-48 flex-wrap gap-1 overflow-y-auto">
                {user.privileges.map((p) => (
                  <Badge key={p} variant="outline" className="font-mono text-xs">{p}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
