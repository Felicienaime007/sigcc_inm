"use client";

import { useMemo } from "react";
import { ActionTile } from "@/components/dashboard/action-tile";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { QueueCard } from "@/components/dashboard/queue-card";
import type { RoleDashboardDef } from "@/components/dashboard/types";
import { SectionHeading } from "@/components/page-header";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/i18n/contexte";

export function RoleDashboard({ def }: { def: RoleDashboardDef }) {
  const { t } = useT();
  const { can } = useAuth();
  const actions = def.actions.filter((a) => !a.privilege || can(a.privilege));

  // Les définitions portent des clés de traduction : on les résout ici, les
  // fonctions (params, row) et les privilèges restant inchangés.
  const texte = useMemo(
    () => ({
      titre: t(def.titre),
      description: t(def.description),
      kpis: def.kpis.map((k) => ({ ...k, label: t(k.label) })),
      actions: actions.map((a) => ({ ...a, label: t(a.label), description: t(a.description) })),
      queues: def.queues.map((q) => ({ ...q, title: t(q.title), empty: t(q.empty) })),
    }),
    [def, actions, t],
  );

  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-[13px] leading-relaxed text-muted-foreground">{texte.description}</p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {texte.kpis.map((k) => <KpiCard key={k.key} def={k} />)}
      </div>

      {texte.actions.length > 0 && (
        <section aria-label={t("dash.acces_rapides")}>
          <SectionHeading title={t("dash.acces_rapides")} accent="bg-teal-600" />
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {texte.actions.map((a) => <ActionTile key={a.href + a.label} action={a} />)}
          </div>
        </section>
      )}

      {texte.queues.length > 0 && (
        <section aria-label={t("dash.a_suivre")}>
          <SectionHeading title={t("dash.a_suivre")} accent="bg-primary" />
          <div className="grid items-start gap-3 md:grid-cols-2">
            {texte.queues.map((q) => <QueueCard key={q.title} def={q} />)}
          </div>
        </section>
      )}
    </div>
  );
}
