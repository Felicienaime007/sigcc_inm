"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Plus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
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
import type { Commande } from "@/types/commercial";

export default function CommandesPage() {
  return (
    <RequirePrivilege privilege="commande.view">
      <Contenu />
    </RequirePrivilege>
  );
}

function Contenu() {
  const router = useRouter();
  // Rafraîchissement : le magasinier voit arriver les commandes validées
  const liste = usePagedList<Commande>("commercial/commandes", { ordering: "-date_commande", refetchInterval: 10000 });
  const [creation, setCreation] = useState(false);

  const colonnes: Column<Commande>[] = [
    {
      key: "num", header: "Commande", sortKey: "id_commande",
      cell: (c) => (
        <Link href={`/commercial/commandes/${c.id_commande}`} className="font-medium hover:underline">
          {c.num_commande}
        </Link>
      ),
    },
    { key: "date", header: "Date", sortKey: "date_commande", cell: (c) => formatDate(c.date_commande) },
    {
      key: "client", header: "Client",
      cell: (c) => (
        <div className="space-y-0.5">
          <p>{c.nom_client}</p>
          <TypeBadge type={c.type_client} />
        </div>
      ),
    },
    {
      key: "origine", header: "Devis / engagement",
      cell: (c) => (
        <div className="text-xs text-muted-foreground">
          {c.num_devis && <p>Devis {c.num_devis}</p>}
          {c.num_engagement_cf && <p>Engagement {c.num_engagement_cf}</p>}
          {!c.num_devis && !c.num_engagement_cf && "—"}
        </div>
      ),
    },
    { key: "total", header: "Total HT", className: "text-right tabular-nums", cell: (c) => formatAr(c.total) },
    { key: "statut", header: "Statut", cell: (c) => <StatusBadge statut={c.statut_commande} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Commandes"
        description="Commandes des SOA et des clients privés. Une commande validée passe en préparation au magasin."
        action={
          <Can privilege="commande.create">
            <Button onClick={() => setCreation(true)}>
              <Plus className="mr-2 h-4 w-4" /> Nouvelle commande
            </Button>
          </Can>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          value={liste.searchInput} onChange={liste.setSearchInput}
          placeholder="N° de commande, client ou code SOA…"
        />
        <FilterSelect
          label="Statut" options={STATUTS_COMMANDE}
          value={String(liste.filters.statut ?? "")}
          onChange={(v) => liste.setFilter("statut", v)}
        />
        <FilterSelect
          label="Type de client" className="w-52"
          options={TYPES_CLIENT.filter((t) => t.value !== "SIMPLE")}
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
        emptyMessage="Aucune commande."
        actions={(c) => (
          <Link href={`/commercial/commandes/${c.id_commande}`} className={buttonVariants({ variant: "ghost", size: "icon" })} title="Ouvrir"><Eye className="h-4 w-4" /></Link>
        )}
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