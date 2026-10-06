"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RequirePrivilege } from "@/components/can";
import { PageHeader } from "@/components/page-header";
import { EntryDialog } from "@/components/audit/entry-dialog";
import { OperationBadge } from "@/components/audit/diff";
import { DataTable, type Column } from "@/components/data/data-table";
import { DateRange } from "@/components/data/data-range";
import { FilterSelect } from "@/components/data/filter-select";
import { SearchInput } from "@/components/data/search-input";
import { useDebounce } from "@/hooks/use-debounce";
import { usePagedList } from "@/hooks/use-paged-list";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { OPERATIONS, libelleTable, resume } from "@/lib/audit";
import { formatDateTime } from "@/lib/format";
import { useOptions } from "@/lib/resource";
import type { AuditEntry } from "@/types/audit";

export default function AuditPage() {
  return (
    <RequirePrivilege privilege="audit.view">
      <Contenu />
    </RequirePrivilege>
  );
}

interface UtilisateurLight {
  id_utilisateur: number;
  identifiant: string;
  nom_complet: string;
}

function Contenu() {
  const { can } = useAuth();
  const liste = usePagedList<AuditEntry>("audit/journal", { ordering: "-date_audit" });
  const [detail, setDetail] = useState<AuditEntry | null>(null);

  const tables = useQuery({
    queryKey: ["audit/journal", "tables"],
    queryFn: async () => (await api.get<string[]>("/audit/journal/tables/")).data,
    staleTime: 5 * 60_000,
  });
  const utilisateurs = useOptions<UtilisateurLight>("users/utilisateurs", {}, can("utilisateur.view"));

  // n° d'objet : filtre exact après une courte pause de saisie
  const [objet, setObjet] = useState("");
  const objetFiltre = useDebounce(objet.trim(), 400);
  useEffect(() => {
    liste.setFilter("objet", objetFiltre);
    // setFilter est stable ; on ne réagit qu'à la valeur saisie
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objetFiltre]);

  const optionsUtilisateur = [
    { value: "SYSTEME", label: "SYSTEME (hors utilisateur)" },
    ...(utilisateurs.data ?? []).map((u) => ({ value: u.identifiant, label: `${u.nom_complet} (${u.identifiant})` })),
  ];

  const colonnes: Column<AuditEntry>[] = [
    { key: "date", header: "Date", sortKey: "date_audit", cell: (e) => <span className="whitespace-nowrap">{formatDateTime(e.date_audit)}</span> },
    {
      key: "user", header: "Utilisateur", sortKey: "identifiant_utilisateur",
      cell: (e) => <span className="font-medium">{e.identifiant_utilisateur}</span>,
    },
    { key: "op", header: "Opération", sortKey: "operation", cell: (e) => <OperationBadge operation={e.operation} /> },
    {
      key: "table", header: "Document", sortKey: "table_nom",
      cell: (e) => (
        <div>
          <p>{libelleTable(e.table_nom)}</p>
          <p className="text-xs text-muted-foreground">{e.reference ?? `n° ${e.id_objet}`}</p>
        </div>
      ),
    },
    {
      key: "resume", header: "Détail",
      cell: (e) => <span className="line-clamp-2 max-w-sm text-sm">{resume(e.operation, e.ancienne_valeur, e.nouvelle_valeur)}</span>,
    },
    { key: "ip", header: "IP", cell: (e) => <span className="text-xs text-muted-foreground">{e.adresse_ip ?? "—"}</span> },
  ];

  return (
    <div>
      <PageHeader
        title="Journal d'audit"
        description="Toutes les créations, modifications et suppressions des documents sensibles : auteur, date et valeurs avant/après. Ce journal est en lecture seule."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={liste.searchInput} onChange={liste.setSearchInput} placeholder="Utilisateur ou n° de document…" />
        <FilterSelect
          label="Document" className="w-56"
          options={(tables.data ?? []).map((t) => ({ value: t, label: libelleTable(t) }))}
          value={String(liste.filters.table ?? "")} onChange={(v) => liste.setFilter("table", v)}
        />
        <FilterSelect
          label="Opération" className="w-48" options={OPERATIONS}
          value={String(liste.filters.operation ?? "")} onChange={(v) => liste.setFilter("operation", v)}
        />
        {can("utilisateur.view") && (
          <FilterSelect
            label="Utilisateur" className="w-64" options={optionsUtilisateur}
            value={String(liste.filters.utilisateur ?? "")} onChange={(v) => liste.setFilter("utilisateur", v)}
          />
        )}
        <Input
          className="w-36" inputMode="numeric" placeholder="N° d'objet"
          title="Identifiant interne du document (ex. 12 pour la facture n° 12 de la base)"
          value={objet} onChange={(e) => setObjet(e.target.value)}
        />
        <DateRange
          du={String(liste.filters.du ?? "")} au={String(liste.filters.au ?? "")}
          onChange={(cle, v) => liste.setFilter(cle, v)}
        />
      </div>

      <DataTable
        columns={colonnes}
        data={liste.query.data}
        isLoading={liste.query.isLoading}
        isFetching={liste.query.isFetching}
        error={liste.query.error}
        rowKey={(e) => e.id_audit}
        page={liste.page} pageSize={liste.pageSize} onPageChange={liste.setPage}
        ordering={liste.ordering} onOrderingChange={liste.setOrdering}
        emptyMessage="Aucun événement pour ces critères."
        actions={(e) => (
          <Button variant="ghost" size="icon" title="Voir le détail" onClick={() => setDetail(e)}>
            <Eye className="h-4 w-4" />
          </Button>
        )}
      />

      {detail && <EntryDialog entry={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}