"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Can, RequirePrivilege } from "@/components/can";
import { PageHeader } from "@/components/page-header";
import { CommandeDialog } from "@/components/commercial/commande-dialog";
import { TypeBadge } from "@/components/clients/type-badge";
import { DataTable, type Column } from "@/components/data/data-table";
import { FilterSelect } from "@/components/data/filter-select";
import { SearchInput } from "@/components/data/search-input";
import { StatusBadge } from "@/components/data/status-badge";
import { usePagedList } from "@/hooks/use-paged-list";
import { STATUTS_COMMANDE } from "@/lib/commercial";
import { TYPES_CLIENT } from "@/lib/clients";
import { formatAr, formatDate } from "@/lib/format";
import { useT } from "@/lib/i18n/contexte";
import type { Commande } from "@/types/commercial";

export default function CommandesPage() {
  return (
    <RequirePrivilege privilege="commande.view">
      <Contenu />
    </RequirePrivilege>
  );
}

function Contenu() {
  const { t } = useT();
  const router = useRouter();
  // Rafraîchissement : le magasinier voit arriver les commandes validées
  const liste = usePagedList<Commande>("commercial/commandes", { ordering: "-date_commande", refetchInterval: 10000 });
  const [creation, setCreation] = useState(false);

  const colonnes: Column<Commande>[] = [
    {
      key: "num", header: "commercial.commandes.col_commande", sortKey: "id_commande",
      cell: (c) => (
        <Link href={`/commercial/commandes/${c.id_commande}`} className="font-medium hover:underline">
          {c.num_commande}
        </Link>
      ),
    },
    { key: "date", header: "commercial.commandes.col_date", sortKey: "date_commande", cell: (c) => formatDate(c.date_commande) },
    {
      key: "client", header: "commercial.commandes.col_client",
      cell: (c) => (
        <div className="space-y-0.5">
          <p>{c.nom_client}</p>
          <TypeBadge type={c.type_client} />
        </div>
      ),
    },
    {
      key: "origine", header: "commercial.commandes.col_origine",
      cell: (c) => (
        <div className="text-xs text-muted-foreground">
          {c.num_devis && <p>{t("commercial.commandes.devis_prefixe", { x: c.num_devis })}</p>}
          {c.num_engagement_cf && <p>{t("commercial.commandes.engagement_prefixe", { x: c.num_engagement_cf })}</p>}
          {!c.num_devis && !c.num_engagement_cf && "—"}
        </div>
      ),
    },
    { key: "total", header: "commercial.commandes.col_total", className: "text-right tabular-nums", cell: (c) => formatAr(c.total) },
    { key: "statut", header: "commercial.commandes.col_statut", cell: (c) => <StatusBadge statut={c.statut_commande} /> },
  ];

  return (
    <div>
      <PageHeader
        title={t("commercial.commandes.titre")}
        description={t("commercial.commandes.description")}
        action={
          <Can privilege="commande.create">
            <Button onClick={() => setCreation(true)}>
              <Plus className="mr-2 h-4 w-4" /> {t("commercial.commandes.nouvelle")}
            </Button>
          </Can>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          value={liste.searchInput} onChange={liste.setSearchInput}
          placeholder={t("commercial.commandes.ph_recherche")}
        />
        <FilterSelect
          label={t("commercial.commandes.filtre_statut")} options={STATUTS_COMMANDE.map((o) => ({ value: o.value, label: t(o.label) }))}
          value={String(liste.filters.statut ?? "")}
          onChange={(v) => liste.setFilter("statut", v)}
        />
        <FilterSelect
          label={t("commercial.commandes.filtre_type_client")} className="w-52"
          options={TYPES_CLIENT.filter((tc) => tc.value !== "SIMPLE").map((o) => ({ value: o.value, label: t(`clients.types.${o.value.toLowerCase()}`) }))}
          value={String(liste.filters.type_client ?? "")}
          onChange={(v) => liste.setFilter("type_client", v)}
        />
      </div>

      <DataTable
        columns={colonnes}
        data={liste.query.data}
        isLoading={liste.query.isLoading}
        isFetching={liste.query.isFetching}
        error={liste.query.error}
        rowKey={(c) => c.id_commande}
        page={liste.page} pageSize={liste.pageSize} onPageChange={liste.setPage}
        ordering={liste.ordering} onOrderingChange={liste.setOrdering}
        emptyMessage="commercial.commandes.vide"
        rowActions={(c) => [
          { key: "ouvrir", label: t("commercial.commandes.ouvrir"), icon: Eye, onSelect: () => router.push(`/commercial/commandes/${c.id_commande}`) },
        ]}
      />

      {creation && (
        <CommandeDialog
          commande={null}
          onClose={() => setCreation(false)}
          onSaved={(c) => router.push(`/commercial/commandes/${c.id_commande}`)}
        />
      )}
    </div>
  );
}
