"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RequirePrivilege } from "@/components/can";
import { PageHeader } from "@/components/page-header";
import { SolvabiliteDialog } from "@/components/clients/solvabilite-dialog";
import { DataTable, type Column } from "@/components/data/data-table";
import { FilterSelect } from "@/components/data/filter-select";
import { SearchInput } from "@/components/data/search-input";
import { usePagedList } from "@/hooks/use-paged-list";
import { useAuth } from "@/lib/auth-context";
import { formatAr, formatNombre } from "@/lib/format";
import { useT } from "@/lib/i18n/contexte";
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
  const { t } = useT();
  const liste = usePagedList<SolvabiliteListe>("clients/solvabilites", { ordering: "-id_solvabilite" });
  const [edition, setEdition] = useState<SolvabiliteListe | null>(null);

  const colonnes: Column<SolvabiliteListe>[] = [
    {
      key: "client", header: "clients.solv.col_client",
      cell: (s) => (
        <Link href={`/clients/${s.client}`} className="font-medium hover:underline">
          {s.nom_client ?? "—"}
        </Link>
      ),
    },
    { key: "score", header: "clients.solv.col_score", className: "text-right tabular-nums", cell: (s) => t("clients.solv.score_valeur", { v: formatNombre(s.score_credit) }) },
    { key: "plafond", header: "clients.solv.col_plafond", className: "text-right tabular-nums", cell: (s) => formatAr(s.plafond_encours) },
    {
      key: "statut", header: "clients.solv.col_statut",
      cell: (s) =>
        s.statut_blocage ? (
          <Badge variant="destructive" title={s.blocage_auto ? t("clients.detail.bloque_auto_hint") : t("clients.detail.bloque_manuel_hint")}>
            {t("clients.detail.bloque", { auto: s.blocage_auto ? t("clients.detail.bloque_auto") : "" })}
          </Badge>
        ) : <Badge variant="secondary">{t("clients.detail.actif")}</Badge>,
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("clients.solv.titre")}
        description={t("clients.solv.description")}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={liste.searchInput} onChange={liste.setSearchInput} placeholder={t("clients.solv.recherche")} />
        <FilterSelect
          label={t("clients.solv.filtre_statut")}
          options={[
            { value: "1", label: t("clients.solv.bloques") },
            { value: "0", label: t("clients.solv.actifs") },
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
        emptyMessage="clients.solv.vide"
        rowActions={(s) =>
          can("solvabilite.update")
            ? [{ key: "modifier", label: t("clients.solv.modifier"), icon: Pencil, onSelect: () => setEdition(s) }]
            : []
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