"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RequirePrivilege } from "@/components/can";
import { PageHeader } from "@/components/page-header";
import { SolvabiliteDialog } from "@/components/clients/solvabilite-dialog";
import { DataTable, type Column } from "@/components/data/data-table";
import { FilterSelect } from "@/components/data/filter-select";
import { SearchInput } from "@/components/data/search-input";
import { usePagedList } from "@/hooks/use-paged-list";
import { useAuth } from "@/lib/auth-context";
import { formatAr, formatNombre } from "@/lib/format";
import type { SolvabiliteListe } from "@/types/clients";

export default function SolvabilitesPage() {
  return (
    <RequirePrivilege privilege="solvabilite.view">
      <Contenu />
    </RequirePrivilege>
  );
}

function Contenu() {
  const { can } = useAuth();
  const liste = usePagedList<SolvabiliteListe>("clients/solvabilites", { ordering: "-id_solvabilite" });
  const [edition, setEdition] = useState<SolvabiliteListe | null>(null);

  const colonnes: Column<SolvabiliteListe>[] = [
    {
      key: "client", header: "Client PRIVE",
      cell: (s) => (
        <Link href={`/clients/${s.client}`} className="font-medium hover:underline">
          {s.nom_client}
        </Link>
      ),
    },
    { key: "score", header: "Score", className: "text-right tabular-nums", cell: (s) => `${formatNombre(s.score_credit)} / 100` },
    { key: "plafond", header: "Plafond d'encours", className: "text-right tabular-nums", cell: (s) => formatAr(s.plafond_encours) },
    {
      key: "statut", header: "Statut",
      cell: (s) =>
        s.statut_blocage ? <Badge variant="destructive">Bloqué</Badge> : <Badge variant="secondary">Actif</Badge>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Solvabilité des clients privés"
        description="Plafonds d'encours et blocages. La fiche se crée depuis la fiche du client."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={liste.searchInput} onChange={liste.setSearchInput} placeholder="Rechercher un client…" />
        <FilterSelect
          label="Statut"
          options={[
            { value: "1", label: "Bloqués" },
            { value: "0", label: "Actifs" },
          ]}
          value={String(liste.filters.statut_blocage ?? "")}
          onChange={(v) => liste.setFilter("statut_blocage", v)}
        />
      </div>

      <DataTable
        columns={colonnes}
        data={liste.query.data}
        isLoading={liste.query.isLoading}
        isFetching={liste.query.isFetching}
        error={liste.query.error}
        rowKey={(s) => s.id_solvabilite}
        page={liste.page}
        pageSize={liste.pageSize}
        onPageChange={liste.setPage}
        emptyMessage="Aucune fiche de solvabilité."
        actions={(s) =>
          can("solvabilite.update") && (
            <Button variant="ghost" size="icon" title="Modifier" onClick={() => setEdition(s)}>
              <Pencil className="h-4 w-4" />
            </Button>
          )
        }
      />

      {edition && (
        <SolvabiliteDialog
          open
          onOpenChange={(o) => !o && setEdition(null)}
          clientId={edition.client}
          clientNom={edition.nom_client}
          fiche={edition}
        />
      )}
    </div>
  );
}