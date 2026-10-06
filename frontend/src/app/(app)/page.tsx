"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RoleDashboard } from "@/components/dashboard/role-dashboard";
import { DASHBOARDS, ORDRE_ROLES } from "@/components/dashboard/role-dashboards";
import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/lib/auth-context";

export default function AccueilPage() {
  const { user, hasRole } = useAuth();
  const [choix, setChoix] = useState<string | null>(null);
  if (!user) return null;

  // L'administrateur peut parcourir tous les espaces ; les autres voient ceux de leurs rôles
  const disponibles = ORDRE_ROLES.filter((r) => DASHBOARDS[r] && (hasRole("ADMIN") || user.roles.includes(r)));
  const actif = disponibles.find((r) => r === choix) ?? disponibles[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Bonjour, ${user.nom_complet}`}
        description={
          disponibles.length > 0
            ? `Matricule ${user.matricule} · ${user.roles.join(", ")}`
            : `Matricule ${user.matricule}`
        }
      />

      {disponibles.length > 1 && (
        <Tabs value={actif} onValueChange={setChoix}>
          <TabsList className="h-auto flex-wrap justify-start">
            {disponibles.map((r) => (
              <TabsTrigger key={r} value={r}>{DASHBOARDS[r].titre}</TabsTrigger>
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
            <CardTitle className="text-base">Mes privilèges</CardTitle>
            <CardDescription>
              Votre rôle n&apos;a pas d&apos;espace de travail dédié. Utilisez le menu pour accéder aux fonctions autorisées.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex max-h-48 flex-wrap gap-1 overflow-y-auto">
            {user.privileges.length === 0 && <span className="text-sm text-muted-foreground">Aucun privilège.</span>}
            {user.privileges.map((p) => (
              <Badge key={p} variant="outline" className="font-mono text-xs">{p}</Badge>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}