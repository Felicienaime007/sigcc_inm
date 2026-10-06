"use client";

import { ActionTile } from "@/components/dashboard/action-tile";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { QueueCard } from "@/components/dashboard/queue-card";
import type { RoleDashboardDef } from "@/components/dashboard/types";
import { useAuth } from "@/lib/auth-context";

export function RoleDashboard({ def }: { def: RoleDashboardDef }) {
  const { can } = useAuth();
  const actions = def.actions.filter((a) => !a.privilege || can(a.privilege));

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{def.description}</p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {def.kpis.map((k) => <KpiCard key={k.key} def={k} />)}
      </div>

      {actions.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Accès rapides
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {actions.map((a) => <ActionTile key={a.href + a.label} action={a} />)}
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {def.queues.map((q) => <QueueCard key={q.title} def={q} />)}
      </div>
    </div>
  );
}