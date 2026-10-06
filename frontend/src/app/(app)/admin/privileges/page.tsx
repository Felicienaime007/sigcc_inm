"use client";

import { RequirePrivilege } from "@/components/can";
import { PageHeader } from "@/components/page-header";
import { DataTable, type Column } from "@/components/data/data-table";
import { SearchInput } from "@/components/data/search-input";
import { usePagedList } from "@/hooks/use-paged-list";
import { libelleAction, libelleModule } from "@/lib/rbac";
import type { Privilege } from "@/types/users";

export default function PrivilegesPage() {
  return (
    <RequirePrivilege privilege="privilege.view">
      <Contenu />
    </RequirePrivilege>
  );
}

function Contenu() {
  const liste = usePagedList<Privilege>("users/privileges", { pageSize: 50, ordering: "code_action" });

  const colonnes: Column<Privilege>[] = [
    {
      key: "code", header: "Code", sortKey: "code_action",
      cell: (p) => <code className="text-xs">{p.code_action}</code>,
    },
    { key: "module", header: "Module", cell: (p) => libelleModule(p.code_action) },
    { key: "action", header: "Action", cell: (p) => libelleAction(p.code_action) },
    { key: "desc", header: "Description", cell: (p) => p.description ?? "—" },
  ];

  return (
    <div>
      <PageHeader
        title="Catalogue des privilèges"
        description="Lecture seule : les privilèges sont définis par l'application (rbac_catalog.py) et accordés aux rôles."
      />
      <div className="mb-4">
        <SearchInput value={liste.searchInput} onChange={liste.setSearchInput} placeholder="Rechercher un code ou une description…" />
      </div>
      <DataTable
        columns={colonnes}
        data={liste.query.data}
        isLoading={liste.query.isLoading}
        isFetching={liste.query.isFetching}
        error={liste.query.error}
        rowKey={(p) => p.id_privilege}
        page={liste.page}
        pageSize={liste.pageSize}
        onPageChange={liste.setPage}
        ordering={liste.ordering}
        onOrderingChange={liste.setOrdering}
      />
    </div>
  );
}