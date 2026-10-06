"use client";

import { useState } from "react";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Can, RequirePrivilege } from "@/components/can";
import { PageHeader } from "@/components/page-header";
import { LignesDialog } from "@/components/commercial/lignes-dialog";
import { PlanificationDialog } from "@/components/commercial/planification-dialog";
import { DataTable, type Column } from "@/components/data/data-table";
import { SearchInput } from "@/components/data/search-input";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { usePagedList } from "@/hooks/use-paged-list";
import { useAuth } from "@/lib/auth-context";
import { formatDate, formatNombre } from "@/lib/format";
import { useCrud } from "@/lib/resource";
import type { Planification } from "@/types/commercial";

type Edition = { mode: "create" } | { mode: "edit"; item: Planification } | null;

export default function PlanificationsPage() {
  return (
    <RequirePrivilege privilege="planification.view">
      <Contenu />
    </RequirePrivilege>
  );
}

function Contenu() {
  const { can } = useAuth();
  const liste = usePagedList<Planification>("commercial/planifications", { ordering: "-date_planif" });
  const crud = useCrud<Planification>("commercial/planifications");

  const [edition, setEdition] = useState<Edition>(null);
  const [detail, setDetail] = useState<Planification | null>(null);
  const [aSupprimer, setASupprimer] = useState<Planification | null>(null);

  async function supprimer() {
    if (!aSupprimer) return;
    try {
      await crud.remove.mutateAsync(aSupprimer.id_planification);
    } catch {
      /* message du serveur déjà affiché en notification */
    }
    setASupprimer(null);
  }

  const colonnes: Column<Planification>[] = [
    { key: "periode", header: "Période", sortKey: "periode_cible", cell: (p) => <span className="font-medium">{p.periode_cible}</span> },
    { key: "client", header: "Client", cell: (p) => p.nom_client },
    { key: "date", header: "Saisie le", sortKey: "date_planif", cell: (p) => formatDate(p.date_planif) },
    {
      key: "lignes", header: "Produits prévus",
      cell: (p) => p.lignes.slice(0, 3).map((l) => `${formatNombre(l.quantite_estimee)} × ${l.code_produit}`).join(", ")
        + (p.lignes.length > 3 ? ` … (+${p.lignes.length - 3})` : ""),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Planifications de besoins"
        description="Besoins prévus des clients par période, pour anticiper la production et le stock."
        action={
          <Can privilege="planification.create">
            <Button onClick={() => setEdition({ mode: "create" })}>
              <Plus className="mr-2 h-4 w-4" /> Nouvelle planification
            </Button>
          </Can>
        }
      />

      <div className="mb-4">
        <SearchInput value={liste.searchInput} onChange={liste.setSearchInput} placeholder="Client ou période…" />
      </div>

      <DataTable
        columns={colonnes}
        data={liste.query.data}
        isLoading={liste.query.isLoading}
        isFetching={liste.query.isFetching}
        error={liste.query.error}
        rowKey={(p) => p.id_planification}
        page={liste.page} pageSize={liste.pageSize} onPageChange={liste.setPage}
        ordering={liste.ordering} onOrderingChange={liste.setOrdering}
        emptyMessage="Aucune planification."
        actions={(p) => (
          <>
            <Button variant="ghost" size="icon" title="Détail" onClick={() => setDetail(p)}>
              <Eye className="h-4 w-4" />
            </Button>
            {can("planification.update") && (
              <Button variant="ghost" size="icon" title="Modifier" onClick={() => setEdition({ mode: "edit", item: p })}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {can("planification.delete") && (
              <Button variant="ghost" size="icon" title="Supprimer" onClick={() => setASupprimer(p)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </>
        )}
      />

      {edition && (
        <PlanificationDialog
          planification={edition.mode === "edit" ? edition.item : null}
          onClose={() => setEdition(null)}
        />
      )}

      {detail && (
        <LignesDialog
          open
          onOpenChange={(o) => !o && setDetail(null)}
          titre={`Planification ${detail.periode_cible}`}
          description={`${detail.nom_client} · saisie le ${formatDate(detail.date_planif)}`}
          libelleQuantite="Quantité estimée"
          lignes={detail.lignes.map((l) => ({
            code_produit: l.code_produit, designation: l.designation, quantite: l.quantite_estimee,
          }))}
        />
      )}

      <ConfirmDialog
        open={aSupprimer !== null}
        onOpenChange={(o) => !o && setASupprimer(null)}
        title="Supprimer la planification ?"
        description={`La planification « ${aSupprimer?.periode_cible ?? ""} » de ${aSupprimer?.nom_client ?? ""} sera supprimée avec ses lignes.`}
        confirmLabel="Supprimer"
        destructive
        loading={crud.remove.isPending}
        onConfirm={supprimer}
      />
    </div>
  );
}