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
import { ReservationDialog } from "@/components/stock/reservation-dialog";
import { usePagedList } from "@/hooks/use-paged-list";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
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
      toast.success(liberees === 0 ? "Aucune réservation expirée." : `${liberees} réservation(s) expirée(s) libérée(s).`);
    } catch {
      /* message déjà affiché */
    }
    setConfirmExpirees(false);
  }

  const colonnes: Column<Reservation>[] = [
    {
      key: "produit", header: "Produit", sortKey: "produit__code_produit",
      cell: (r) => (
        <div>
          <p className="font-medium">{r.designation}</p>
          <p className="text-xs text-muted-foreground">{r.code_produit}</p>
        </div>
      ),
    },
    { key: "qte", header: "Quantité bloquée", sortKey: "quantite_bloquee", className: "text-right tabular-nums", cell: (r) => formatNombre(r.quantite_bloquee) },
    {
      key: "origine", header: "Rattachée à",
      cell: (r) => r.num_commande ? `Commande ${r.num_commande}` : <span className="text-muted-foreground">Réservation manuelle</span>,
    },
    {
      key: "limite", header: "Date limite", sortKey: "date_limite",
      cell: (r) => {
        const expiree = new Date(r.date_limite) < new Date();
        return (
          <span className="inline-flex items-center gap-2">
            {formatDateTime(r.date_limite)}
            {expiree && <Badge variant="destructive" className="text-[10px]">Expirée</Badge>}
          </span>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Réservations de stock"
        description="Quantités bloquées pour des commandes. Elles sont consommées par la livraison et libérées à l'expiration."
        action={
          <div className="flex flex-wrap gap-2">
            <Can privilege="reservation.delete">
              <Button variant="outline" onClick={() => setConfirmExpirees(true)}>
                <Unlock className="mr-2 h-4 w-4" /> Libérer les expirées
              </Button>
            </Can>
            <Can privilege="reservation.create">
              <Button onClick={() => setCreation(true)}>
                <Plus className="mr-2 h-4 w-4" /> Nouvelle réservation
              </Button>
            </Can>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={liste.searchInput} onChange={liste.setSearchInput} placeholder="Produit ou n° de commande…" />
        {can("produit.view") && (
          <FilterSelect
            label="Produit" className="w-60"
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
        emptyMessage="Aucune réservation active."
        actions={(r) =>
          can("reservation.delete") ? (
            <Button variant="ghost" size="icon" title="Libérer" onClick={() => setALiberer(r)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          ) : null
        }
      />

      {creation && <ReservationDialog onClose={() => setCreation(false)} />}

      <ConfirmDialog
        open={aLiberer !== null}
        onOpenChange={(o) => !o && setALiberer(null)}
        title="Libérer la réservation ?"
        description={
          aLiberer?.num_commande
            ? `Les ${aLiberer.quantite_bloquee} × ${aLiberer.code_produit} réservés pour la commande ${aLiberer.num_commande} redeviennent disponibles. La préparation ne pourra plus être terminée avant une nouvelle réservation.`
            : `Les ${aLiberer?.quantite_bloquee ?? ""} × ${aLiberer?.code_produit ?? ""} réservés redeviennent disponibles.`
        }
        confirmLabel="Libérer"
        destructive
        loading={crud.remove.isPending}
        onConfirm={liberer}
      />
      <ConfirmDialog
        open={confirmExpirees}
        onOpenChange={setConfirmExpirees}
        title="Libérer les réservations expirées ?"
        description="Toutes les réservations dont la date limite est dépassée sont libérées. Une préparation concernée devra être réservée de nouveau avant d'être terminée."
        confirmLabel="Libérer"
        loading={expirees.isPending}
        onConfirm={libererExpirees}
      />
    </div>
  );
}