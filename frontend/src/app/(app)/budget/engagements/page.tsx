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
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { usePagedList } from "@/hooks/use-paged-list";
import { useAuth } from "@/lib/auth-context";
import { anneeCourante } from "@/lib/dates";
import { formatAr, formatDate } from "@/lib/format";
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
  const liste = usePagedList<Engagement>("budget/engagements", { ordering: "-date_visa_cf" });
  const annuler = useRecordAction("budget/engagements", "annuler", "Engagement annulé, crédit restitué à la ligne.");
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
      key: "num", header: "N° engagement", sortKey: "num_engagement_cf",
      cell: (e) => <span className="font-medium">{e.num_engagement_cf}</span>,
    },
    {
      key: "soa", header: "SOA",
      cell: (e) => (
        <div>
          <p>{e.nom_client}</p>
          {e.code_soa && <p className="text-xs text-muted-foreground">SOA {e.code_soa}</p>}
        </div>
      ),
    },
    {
      key: "ligne", header: "Ligne budgétaire",
      cell: (e) => (
        <div>
          <p>Article {e.code_article} · {e.annee_budgetaire}</p>
          <p className="text-xs text-muted-foreground">{e.nom_organisme}</p>
        </div>
      ),
    },
    {
      key: "montant", header: "Montant", className: "text-right tabular-nums", sortKey: "montant_engage",
      cell: (e) => formatAr(e.montant_engage),
    },
    { key: "visa", header: "Visé le", sortKey: "date_visa_cf", cell: (e) => formatDate(e.date_visa_cf) },
    {
      key: "statut", header: "Statut",
      cell: (e) => (
        <div className="flex flex-col items-start gap-1">
          <StatusBadge statut={e.statut_engagement} />
          {e.id_commande && can("commande.view") && (
            <Link href={`/commercial/commandes/${e.id_commande}`} className="text-xs text-muted-foreground hover:underline">
              Commande liée
            </Link>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Engagements budgétaires"
        description="Crédits engagés pour les SOA après visa du Contrôle financier. Un engagement visé est consommé par la validation d'une commande."
        action={
          <Can privilege="engagement.create">
            <Button onClick={() => setEdition({ mode: "create" })}>
              <Plus className="mr-2 h-4 w-4" /> Nouvel engagement
            </Button>
          </Can>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          value={liste.searchInput} onChange={liste.setSearchInput}
          placeholder="N° d'engagement, SOA ou code SOA…"
        />
        <FilterSelect
          label="Statut" options={STATUTS_ENGAGEMENT}
          value={String(liste.filters.statut ?? "")}
          onChange={(v) => liste.setFilter("statut", v)}
        />
        <FilterSelect
          label="Année" className="w-36"
          options={[anneeCourante() + 1, anneeCourante(), anneeCourante() - 1, anneeCourante() - 2]
            .map((a) => ({ value: String(a), label: String(a) }))}
          value={String(liste.filters.annee ?? "")}
          onChange={(v) => liste.setFilter("annee", v)}
        />
        {can("organisme.view") && (
          <FilterSelect
            label="Organisme" className="w-60"
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
        emptyMessage="Aucun engagement."
        actions={(e) =>
          e.statut_engagement === "VISE" && can("engagement.update") ? (
            <>
              <Button variant="ghost" size="icon" title="Corriger le n° ou la date de visa" onClick={() => setEdition({ mode: "edit", item: e })}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost" size="icon"
                title={e.id_commande ? "Rattaché à une commande : annulez d'abord la commande" : "Annuler l'engagement"}
                disabled={e.id_commande !== null}
                onClick={() => setAAnnuler(e)}
              >
                <Ban className="h-4 w-4 text-destructive" />
              </Button>
            </>
          ) : null
        }
      />

      {edition && (
        <EngagementDialog engagement={edition.mode === "edit" ? edition.item : null} onClose={() => setEdition(null)} />
      )}

      <ConfirmDialog
        open={aAnnuler !== null}
        onOpenChange={(o) => !o && setAAnnuler(null)}
        title="Annuler l'engagement ?"
        description={`L'engagement ${aAnnuler?.num_engagement_cf ?? ""} (${formatAr(aAnnuler?.montant_engage)}) est annulé et son montant est restitué au crédit de la ligne ${aAnnuler?.code_article ?? ""}. Cette action est définitive.`}
        confirmLabel="Annuler l'engagement"
        destructive
        loading={annuler.isPending}
        onConfirm={confirmerAnnulation}
      />
    </div>
  );
}