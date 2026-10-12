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
import { DangerConfirm } from "@/components/forms/danger-confirm";
import { usePagedList } from "@/hooks/use-paged-list";
import { useAuth } from "@/lib/auth-context";
import { formatDate, formatNombre } from "@/lib/format";
import { useCrud } from "@/lib/resource";
import { useT } from "@/lib/i18n/contexte";
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
  const { t } = useT();
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
    { key: "periode", header: "commercial.planifications.col_periode", sortKey: "periode_cible", cell: (p) => <span className="font-medium">{p.periode_cible}</span> },
    { key: "client", header: "commercial.planifications.col_client", cell: (p) => p.nom_client },
    { key: "date", header: "commercial.planifications.col_saisie", sortKey: "date_planif", cell: (p) => formatDate(p.date_planif) },
    {
      key: "lignes", header: "commercial.planifications.col_produits",
      cell: (p) => p.lignes.slice(0, 3).map((l) => `${formatNombre(l.quantite_estimee)} × ${l.code_produit}`).join(", ")
        + (p.lignes.length > 3 ? t("commercial.planifications.suite", { x: p.lignes.length - 3 }) : ""),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("commercial.planifications.titre")}
        description={t("commercial.planifications.description")}
        action={
          <Can privilege="planification.create">
            <Button onClick={() => setEdition({ mode: "create" })}>
              <Plus className="mr-2 h-4 w-4" /> {t("commercial.planifications.nouvelle")}
            </Button>
          </Can>
        }
      />

      <div className="mb-4">
        <SearchInput value={liste.searchInput} onChange={liste.setSearchInput} placeholder={t("commercial.planifications.ph_recherche")} />
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
        emptyMessage="commercial.planifications.vide"
        rowActions={(p) => [
          { key: "detail", label: t("commercial.planifications.detail"), icon: Eye, onSelect: () => setDetail(p) },
          ...(can("planification.update")
            ? [{ key: "modifier", label: t("commercial.planifications.modifier"), icon: Pencil, onSelect: () => setEdition({ mode: "edit", item: p }) }]
            : []),
          ...(can("planification.delete")
            ? [{ key: "supprimer", label: t("commercial.planifications.supprimer"), icon: Trash2, danger: true, onSelect: () => setASupprimer(p) }]
            : []),
        ]}
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
          titre={t("commercial.planifications.dlg_titre", { x: detail.periode_cible })}
          description={`${detail.nom_client} · ${t("commercial.planifications.col_saisie")} ${formatDate(detail.date_planif)}`}
          libelleQuantite={t("commercial.planifications.qte_estimee")}
          lignes={detail.lignes.map((l) => ({
            code_produit: l.code_produit, designation: l.designation, quantite: l.quantite_estimee,
          }))}
        />
      )}

      <DangerConfirm
        open={aSupprimer !== null}
        onOpenChange={(o) => !o && setASupprimer(null)}
        title={t("commercial.planifications.confirm_titre")}
        description={t("commercial.planifications.confirm_desc", { periode: aSupprimer?.periode_cible ?? "", client: aSupprimer?.nom_client ?? "" })}
        confirmLabel={t("commercial.planifications.confirm_btn")}
        loading={crud.remove.isPending}
        onConfirm={supprimer}
      />
    </div>
  );
}
