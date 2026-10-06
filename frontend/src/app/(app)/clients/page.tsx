"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RequirePrivilege } from "@/components/can";
import { PageHeader } from "@/components/page-header";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import { TypeBadge } from "@/components/clients/type-badge";
import { DataTable, type Column } from "@/components/data/data-table";
import { FilterSelect } from "@/components/data/filter-select";
import { SearchInput } from "@/components/data/search-input";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { usePagedList } from "@/hooks/use-paged-list";
import { useAuth } from "@/lib/auth-context";
import { TYPES_CLIENT, estSoa, peutGerer, typesGerables, typesVisibles } from "@/lib/clients";
import { formatAr } from "@/lib/format";
import { useCrud, useOptions } from "@/lib/resource";
import type { Client, Organisme } from "@/types/clients";

type Edition = { mode: "create" } | { mode: "edit"; item: Client } | null;

export default function ClientsPage() {
  return (
    <RequirePrivilege privilege={["client.view", "client_simple.view"]}>
      <Contenu />
    </RequirePrivilege>
  );
}

function Contenu() {
  const { can } = useAuth();
  const visibles = typesVisibles(can);
  const seulementComptoir = visibles.length === 1 && visibles[0] === "SIMPLE";
  const voitSoa = visibles.includes("MINISTERE");
  const peutCreer = typesGerables(can, "create").length > 0;

  const liste = usePagedList<Client>("clients/clients", { ordering: "nom_client" });
  const crud = useCrud<Client>("clients/clients");
  const { data: organismes } = useOptions<Organisme>("clients/organismes", {}, voitSoa && can("organisme.view"));

  const [edition, setEdition] = useState<Edition>(null);
  const [aSupprimer, setASupprimer] = useState<Client | null>(null);

  async function supprimer() {
    if (!aSupprimer) return;
    try {
      await crud.remove.mutateAsync(aSupprimer.id_client);
    } catch {
      /* message du serveur (409 : engagements, commandes…) déjà affiché en notification */
    }
    setASupprimer(null);
  }

  const colonnes: Column<Client>[] = [
    {
      key: "nom", header: "Client", sortKey: "nom_client",
      cell: (c) => (
        <div>
          <Link href={`/clients/${c.id_client}`} className="font-medium hover:underline">
            {c.nom_client}
          </Link>
          {c.code_soa && <p className="text-xs text-muted-foreground">SOA {c.code_soa}</p>}
        </div>
      ),
    },
    { key: "type", header: "Type", sortKey: "type_client", cell: (c) => <TypeBadge type={c.type_client} /> },
    ...(voitSoa
      ? [{
          key: "organisme", header: "Organisme",
          cell: (c: Client) => c.nom_organisme ?? <span className="text-muted-foreground">—</span>,
        }]
      : []),
    {
      key: "lieu", header: "Localisation",
      cell: (c) =>
        estSoa(c.type_client) ? (
          <div>
            <p>{c.localisation}</p>
            <p className="text-xs text-muted-foreground">{c.nom_district} · {c.nom_region}</p>
          </div>
        ) : (
          <span>{c.ville ?? "—"}</span>
        ),
    },
    { key: "tel", header: "Téléphone", cell: (c) => c.telephone ?? "—" },
    ...(can("solvabilite.view") && visibles.includes("PRIVE")
      ? [{
          key: "solv", header: "Solvabilité",
          cell: (c: Client) => {
            if (c.type_client !== "PRIVE") return <span className="text-muted-foreground">—</span>;
            if (!c.solvabilite) return <Badge variant="outline" className="border-amber-400 text-amber-700">Sans fiche</Badge>;
            if (c.solvabilite.statut_blocage) return <Badge variant="destructive">Bloqué</Badge>;
            return <span className="text-xs tabular-nums">Plafond {formatAr(c.solvabilite.plafond_encours)}</span>;
          },
        }]
      : []),
  ];

  return (
    <div>
      <PageHeader
        title={seulementComptoir ? "Clients du comptoir" : "Clients"}
        description={
          seulementComptoir
            ? "Clients de passage qui achètent au comptoir : leur dossier est transmis directement au caissier."
            : visibles.includes("SIMPLE")
              ? "Ministères et collectivités (SOA), clients privés et clients du comptoir."
              : "Ministères et collectivités (SOA) et clients privés."
        }
        action={
          peutCreer && (
            <Button onClick={() => setEdition({ mode: "create" })}>
              <Plus className="mr-2 h-4 w-4" />
              {seulementComptoir ? "Nouveau client comptoir" : "Nouveau client"}
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          value={liste.searchInput}
          onChange={liste.setSearchInput}
          placeholder={seulementComptoir ? "Nom, ville, CIN ou téléphone…" : "Nom, code SOA, ville, NIF/CIN ou téléphone…"}
        />
        {visibles.length > 1 && (
          <FilterSelect
            label="Type"
            options={TYPES_CLIENT.filter((t) => visibles.includes(t.value))}
            value={String(liste.filters.type_client ?? "")}
            onChange={(v) => liste.setFilter("type_client", v)}
          />
        )}
        {voitSoa && can("organisme.view") && (
          <FilterSelect
            label="Organisme"
            className="w-60"
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
        rowKey={(c) => c.id_client}
        page={liste.page}
        pageSize={liste.pageSize}
        onPageChange={liste.setPage}
        ordering={liste.ordering}
        onOrderingChange={liste.setOrdering}
        emptyMessage="Aucun client."
        actions={(c) => (
          <>
            {peutGerer(can, c.type_client, "update") && (
              <Button variant="ghost" size="icon" title="Modifier" onClick={() => setEdition({ mode: "edit", item: c })}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {peutGerer(can, c.type_client, "delete") && (
              <Button variant="ghost" size="icon" title="Supprimer" onClick={() => setASupprimer(c)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </>
        )}
      />

      <ClientFormDialog
        open={edition !== null}
        onOpenChange={(o) => !o && setEdition(null)}
        client={edition?.mode === "edit" ? edition.item : null}
      />

      <ConfirmDialog
        open={aSupprimer !== null}
        onOpenChange={(o) => !o && setASupprimer(null)}
        title="Supprimer le client ?"
        description={`« ${aSupprimer?.nom_client ?? ""} » sera supprimé définitivement avec sa fiche de solvabilité. Impossible si des commandes, devis, factures ou engagements lui sont rattachés.`}
        confirmLabel="Supprimer"
        destructive
        loading={crud.remove.isPending}
        onConfirm={supprimer}
      />
    </div>
  );
}