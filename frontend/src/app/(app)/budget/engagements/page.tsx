"use client";

import { useState } from "react";
import Link from "next/link";
import { Ban, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Can, RequirePrivilege } from "@/components/can";
import { PageHeader } from "@/components/page-header";
import { EngagementDialog } from "@/components/budget/engagement-dialog";
import { DataTable, type Column } from "@/components/data/data-table";
import { FilterSelect } from "@/components/data/filter-select";
import { SearchInput } from "@/components/data/search-input";
import { StatusBadge } from "@/components/data/status-badge";
import { DangerConfirm } from "@/components/forms/danger-confirm";
import { usePagedList } from "@/hooks/use-paged-list";
import { useAuth } from "@/lib/auth-context";
import { anneeCourante } from "@/lib/dates";
import { formatAr, formatDate } from "@/lib/format";
import { useT } from "@/lib/i18n/contexte";
import { useOptions, useRecordAction } from "@/lib/resource";
import type { Organisme } from "@/types/clients";
import { STATUTS_ENGAGEMENT, type Engagement } from "@/types/budget";

type Edition = { mode: "create" } | { mode: "edit"; item: Engagement } | null;

export default function EngagementsPage() {
  return (
    <RequirePrivilege privilege="engagement.view">
      <Contenu />
    </RequirePrivilege>
  );
}

function Contenu() {
  const { can } = useAuth();
  const { t } = useT();
  const liste = usePagedList<Engagement>("budget/engagements", { ordering: "-date_visa_cf" });
  const annuler = useRecordAction("budget/engagements", "annuler", t("budget.enga.annule_toast"));
  const { data: organismes } = useOptions<Organisme>("clients/organismes", {}, can("organisme.view"));

  const [edition, setEdition] = useState<Edition>(null);
  const [aAnnuler, setAAnnuler] = useState<Engagement | null>(null);

  async function confirmerAnnulation() {
    if (!aAnnuler) return;
    try {
      await annuler.mutateAsync({ id: aAnnuler.id_engagement });
    } catch {
      /* message du serveur (ex. engagement rattaché à une commande) déjà affiché en notification */
    }
    setAAnnuler(null);
  }

  const colonnes: Column<Engagement>[] = [
    {
      key: "num", header: "budget.enga.col_num", sortKey: "num_engagement_cf",
      cell: (e) => <span className="font-medium">{e.num_engagement_cf}</span>,
    },
    {
      key: "soa", header: "budget.enga.col_soa",
      cell: (e) => (
        <div>
          <p>{e.nom_client}</p>
          {e.code_soa && <p className="text-xs text-muted-foreground">SOA {e.code_soa}</p>}
        </div>
      ),
    },
    {
      key: "ligne", header: "budget.enga.col_ligne",
      cell: (e) => (
        <div>
          <p>{t("budget.enga.ligne_valeur", { code: e.code_article, annee: e.annee_budgetaire })}</p>
          <p className="text-xs text-muted-foreground">{e.nom_organisme}</p>
        </div>
      ),
    },
    {
      key: "montant", header: "budget.enga.col_montant", className: "text-right tabular-nums", sortKey: "montant_engage",
      cell: (e) => formatAr(e.montant_engage),
    },
    { key: "visa", header: "budget.enga.col_visa", sortKey: "date_visa_cf", cell: (e) => formatDate(e.date_visa_cf) },
    {
      key: "statut", header: "budget.enga.col_statut",
      cell: (e) => (
        <div className="flex flex-col items-start gap-1">
          <StatusBadge statut={e.statut_engagement} />
          {e.id_commande && can("commande.view") && (
            <Link href={`/commercial/commandes/${e.id_commande}`} className="text-xs text-muted-foreground hover:underline">
              {t("budget.enga.commande_liee")}
            </Link>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("budget.enga.titre")}
        description={t("budget.enga.description")}
        action={
          <Can privilege="engagement.create">
            <Button onClick={() => setEdition({ mode: "create" })}>
              <Plus className="mr-2 h-4 w-4" /> {t("budget.enga.nouveau")}
            </Button>
          </Can>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          value={liste.searchInput} onChange={liste.setSearchInput}
          placeholder={t("budget.enga.recherche")}
        />
        <FilterSelect
          label={t("budget.enga.filtre_statut")} options={STATUTS_ENGAGEMENT.map((o) => ({ value: o.value, label: t(o.label) }))}
          value={String(liste.filters.statut ?? "")}
          onChange={(v) => liste.setFilter("statut", v)}
        />
        <FilterSelect
          label={t("budget.enga.filtre_annee")} className="w-36"
          options={[anneeCourante() + 1, anneeCourante(), anneeCourante() - 1, anneeCourante() - 2]
            .map((a) => ({ value: String(a), label: String(a) }))}
          value={String(liste.filters.annee ?? "")}
          onChange={(v) => liste.setFilter("annee", v)}
        />
        {can("organisme.view") && (
          <FilterSelect
            label={t("budget.enga.filtre_organisme")} className="w-60"
            options={(organismes ?? []).map((o) => ({ value: String(o.id_organisme), label: o.nom_organisme }))}
            value={String(liste.filters.organisme ?? "")}
            onChange={(v) => liste.setFilter("organisme", v)}
          />
        )}
      </div>

      <DataTable
        columns={colonnes}
        data={liste.query.data}
        isLoading={liste.query.isLoading}
        isFetching={liste.query.isFetching}
        error={liste.query.error}
        rowKey={(e) => e.id_engagement}
        page={liste.page} pageSize={liste.pageSize} onPageChange={liste.setPage}
        ordering={liste.ordering} onOrderingChange={liste.setOrdering}
        emptyMessage="budget.enga.vide"
        rowActions={(e) =>
          e.statut_engagement === "VISE" && can("engagement.update")
            ? [
                { key: "corriger", label: t("budget.enga.corriger"), icon: Pencil, onSelect: () => setEdition({ mode: "edit", item: e }) },
                {
                  key: "annuler",
                  label: t("budget.enga.annuler"),
                  icon: Ban,
                  danger: true,
                  disabled: e.id_commande != null,
                  disabledReason: e.id_commande != null ? t("budget.enga.rattache_hint") : undefined,
                  onSelect: () => setAAnnuler(e),
                },
              ]
            : []
        }
      />

      {edition && (
        <EngagementDialog engagement={edition.mode === "edit" ? edition.item : null} onClose={() => setEdition(null)} />
      )}

      <DangerConfirm
        open={aAnnuler !== null}
        onOpenChange={(o) => !o && setAAnnuler(null)}
        title={t("budget.enga.annuler_titre")}
        description={t("budget.enga.annuler_desc", {
          num: aAnnuler?.num_engagement_cf ?? "",
          montant: formatAr(aAnnuler?.montant_engage),
          code: aAnnuler?.code_article ?? "",
        })}
        effetFinancier={aAnnuler ? t("budget.enga.annuler_effet", { montant: formatAr(aAnnuler.montant_engage), code: aAnnuler.code_article }) : undefined}
        requireText={aAnnuler?.num_engagement_cf ?? undefined}
        confirmLabel={t("budget.enga.annuler_btn")}
        loading={annuler.isPending}
        onConfirm={confirmerAnnulation}
      />
    </div>
  );
}