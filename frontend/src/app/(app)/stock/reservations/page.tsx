"use client";

import { useState } from "react";
import { Plus, Trash2, Unlock } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Can, RequirePrivilege } from "@/components/can";
import { PageHeader } from "@/components/page-header";
import { DataTable, type Column } from "@/components/data/data-table";
import { FilterSelect } from "@/components/data/filter-select";
import { SearchInput } from "@/components/data/search-input";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { DangerConfirm } from "@/components/forms/danger-confirm";
import { ReservationDialog } from "@/components/stock/reservation-dialog";
import { usePagedList } from "@/hooks/use-paged-list";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/i18n/contexte";
import { formatDateTime, formatNombre } from "@/lib/format";
import { useApiMutation, useCrud, useOptions } from "@/lib/resource";
import type { ProduitRef, Reservation } from "@/types/stock";

export default function ReservationsPage() {
  return (
    <RequirePrivilege privilege="reservation.view">
      <Contenu />
    </RequirePrivilege>
  );
}

function Contenu() {
  const { can } = useAuth();
  const { t } = useT();
  const liste = usePagedList<Reservation>("stock/reservations", { ordering: "date_limite", refetchInterval: 15_000 });
  const crud = useCrud<Reservation>("stock/reservations");
  const produits = useOptions<ProduitRef>("produits", {}, can("produit.view"));
  const expirees = useApiMutation(
    async () => (await api.post<{ liberees: number }>("/stock/reservations/liberer-expirees/")).data,
    {},
  );

  const [creation, setCreation] = useState(false);
  const [aLiberer, setALiberer] = useState<Reservation | null>(null);
  const [confirmExpirees, setConfirmExpirees] = useState(false);

  async function liberer() {
    if (!aLiberer) return;
    try {
      await crud.remove.mutateAsync(aLiberer.id_reservation);
    } catch {
      /* message du serveur déjà affiché en notification */
    }
    setALiberer(null);
  }

  async function libererExpirees() {
    try {
      const { liberees } = await expirees.mutateAsync(undefined);
      toast.success(liberees === 0 ? t("stock.reservations.toast_aucune_expiree") : t("stock.reservations.toast_liberees", { n: liberees }));
    } catch {
      /* message déjà affiché */
    }
    setConfirmExpirees(false);
  }

  const colonnes: Column<Reservation>[] = [
    {
      key: "produit", header: "stock.reservations.col_produit", sortKey: "produit__code_produit",
      cell: (r) => (
        <div>
          <p className="font-medium">{r.designation}</p>
          <p className="text-xs text-muted-foreground">{r.code_produit}</p>
        </div>
      ),
    },
    { key: "qte", header: "stock.reservations.col_quantite", sortKey: "quantite_bloquee", className: "text-right tabular-nums", cell: (r) => formatNombre(r.quantite_bloquee) },
    {
      key: "origine", header: "stock.reservations.col_origine",
      cell: (r) => r.num_commande ? t("stock.reservations.origine_commande", { num: r.num_commande }) : <span className="text-muted-foreground">{t("stock.reservations.origine_manuelle")}</span>,
    },
    {
      key: "limite", header: "stock.reservations.col_limite", sortKey: "date_limite",
      cell: (r) => {
        // Comme le serveur : expirée si la limite est avant aujourd'hui (comparaison au jour, pas à l'instant)
        const limite = new Date(r.date_limite);
        const aujourdhui = new Date();
        aujourdhui.setHours(0, 0, 0, 0);
        const expiree = limite < aujourdhui;
        return (
          <span className="inline-flex items-center gap-2">
            {formatDateTime(r.date_limite)}
            {expiree && <Badge variant="destructive" className="text-[10px]">{t("stock.reservations.badge_expiree")}</Badge>}
          </span>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("stock.reservations.titre")}
        description={t("stock.reservations.description")}
        action={
          <div className="flex flex-wrap gap-2">
            <Can privilege="reservation.delete">
              <Button variant="outline" onClick={() => setConfirmExpirees(true)}>
                <Unlock className="mr-2 h-4 w-4" /> {t("stock.reservations.btn_liberer_expirees")}
              </Button>
            </Can>
            <Can privilege="reservation.create">
              <Button onClick={() => setCreation(true)}>
                <Plus className="mr-2 h-4 w-4" /> {t("stock.reservations.btn_nouvelle")}
              </Button>
            </Can>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={liste.searchInput} onChange={liste.setSearchInput} placeholder={t("stock.reservations.ph_recherche")} />
        {can("produit.view") && (
          <FilterSelect
            label={t("stock.reservations.filtre_produit")} className="w-60"
            options={(produits.data ?? []).map((p) => ({ value: String(p.id_produit), label: `${p.code_produit} — ${p.designation}` }))}
            value={String(liste.filters.produit ?? "")} onChange={(v) => liste.setFilter("produit", v)}
          />
        )}
      </div>

      <DataTable
        columns={colonnes}
        data={liste.query.data}
        isLoading={liste.query.isLoading}
        isFetching={liste.query.isFetching}
        error={liste.query.error}
        rowKey={(r) => r.id_reservation}
        page={liste.page} pageSize={liste.pageSize} onPageChange={liste.setPage}
        ordering={liste.ordering} onOrderingChange={liste.setOrdering}
        emptyMessage="stock.reservations.vide"
        rowActions={(r) =>
          can("reservation.delete")
            ? [{ key: "liberer", label: t("stock.reservations.act_liberer"), icon: Trash2, danger: true, onSelect: () => setALiberer(r) }]
            : []
        }
      />

      {creation && <ReservationDialog onClose={() => setCreation(false)} />}

      <DangerConfirm
        open={aLiberer !== null}
        onOpenChange={(o) => !o && setALiberer(null)}
        title={t("stock.reservations.confirm_liberer_titre")}
        description={
          aLiberer?.num_commande
            ? t("stock.reservations.confirm_liberer_avec_cmd", { qte: aLiberer.quantite_bloquee, code: aLiberer.code_produit, num: aLiberer.num_commande })
            : t("stock.reservations.confirm_liberer_sans_cmd", { qte: aLiberer?.quantite_bloquee ?? "", code: aLiberer?.code_produit ?? "" })
        }
        confirmLabel={t("stock.reservations.confirm_liberer_btn")}
        loading={crud.remove.isPending}
        onConfirm={liberer}
      />
      <ConfirmDialog
        open={confirmExpirees}
        onOpenChange={setConfirmExpirees}
        title={t("stock.reservations.confirm_expirees_titre")}
        description={t("stock.reservations.confirm_expirees_desc")}
        confirmLabel={t("stock.reservations.confirm_expirees_btn")}
        loading={expirees.isPending}
        onConfirm={libererExpirees}
      />
    </div>
  );
}
