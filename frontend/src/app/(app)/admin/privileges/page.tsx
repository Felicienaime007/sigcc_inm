"use client";

import { RequirePrivilege } from "@/components/can";
import { PageHeader } from "@/components/page-header";
import { DataTable, type Column } from "@/components/data/data-table";
import { SearchInput } from "@/components/data/search-input";
import { usePagedList } from "@/hooks/use-paged-list";
import { libelleAction, libelleModule } from "@/lib/rbac";
import { useT } from "@/lib/i18n/contexte";
import type { Privilege } from "@/types/users";

export default function PrivilegesPage() {
  return (
    <RequirePrivilege privilege="privilege.view">
      <Contenu />
    </RequirePrivilege>
  );
}

function Contenu() {
  const { t } = useT();
  const liste = usePagedList<Privilege>("users/privileges", { pageSize: 50, ordering: "code_action" });

  const colonnes: Column<Privilege>[] = [
    {
      key: "code", header: "admin.privileges.col_code", sortKey: "code_action",
      cell: (p) => <code className="text-xs">{p.code_action}</code>,
    },
    { key: "module", header: "admin.privileges.col_module", cell: (p) => t(libelleModule(p.code_action)) },
    { key: "action", header: "admin.privileges.col_action", cell: (p) => t(libelleAction(p.code_action)) },
    { key: "desc", header: "admin.privileges.col_description", cell: (p) => p.description ?? "—" },
  ];

  return (
    <div>
      <PageHeader
        title={t("admin.privileges.titre")}
        description={t("admin.privileges.description")}
      />
      <div className="mb-4">
        <SearchInput value={liste.searchInput} onChange={liste.setSearchInput} placeholder={t("admin.privileges.recherche_ph")} />
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
