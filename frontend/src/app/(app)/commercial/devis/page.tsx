"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, FilePlus2, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Can, RequirePrivilege } from "@/components/can";
import { PageHeader } from "@/components/page-header";
import { CommandeDialog } from "@/components/commercial/commande-dialog";
import { DevisDialog } from "@/components/commercial/devis-dialog";
import { LignesDialog } from "@/components/commercial/lignes-dialog";
import { DataTable, type Column } from "@/components/data/data-table";
import { FilterSelect } from "@/components/data/filter-select";
import { SearchInput } from "@/components/data/search-input";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { usePagedList } from "@/hooks/use-paged-list";
import { useAuth } from "@/lib/auth-context";
import { anneeCourante } from "@/lib/dates";
import { formatAr, formatDate } from "@/lib/format";
import { useCrud } from "@/lib/resource";
import type { Devis } from "@/types/commercial";

type Edition = { mode: "create" } | { mode: "edit"; item: Devis } | null;

export default function DevisPage() {
  return (
    <RequirePrivilege privilege="devis.view">
      <Contenu />
    </RequirePrivilege>
  );
}

function StatutDevis({ d }: { d: Devis }) {
  if (d.id_commande) return <Badge variant="secondary">Converti en commande</Badge>;
  if (d.est_expire) return <Badge variant="destructive">Expiré</Badge>;
  return <Badge variant="outline">Valable</Badge>;
}

function Contenu() {
  const { can } = useAuth();
  const router = useRouter();
  const liste = usePagedList<Devis>("commercial/devis", { ordering: "-date_devis" });
  const crud = useCrud<Devis>("commercial/devis");

  const [edition, setEdition] = useState<Edition>(null);
  const [detail, setDetail] = useState<Devis | null>(null);
  const [commandeDe, setCommandeDe] = useState<Devis | null>(null);
  const [aSupprimer, setASupprimer] = useState<Devis | null>(null);

  async function supprimer() {
    if (!aSupprimer) return;
    try {
      await crud.remove.mutateAsync(aSupprimer.id_devis);
    } catch {
      /* 409 : une commande est issue de ce devis */
    }
    setASupprimer(null);
  }

  const colonnes: Column<Devis>[] = [
    { key: "num", header: "Devis", sortKey: "id_devis", cell: (d) => <span className="font-medium">{d.num_devis}</span> },
    { key: "date", header: "Date", sortKey: "date_devis", cell: (d) => formatDate(d.date_devis) },
    { key: "client", header: "Client", cell: (d) => d.nom_client },
    { key: "validite", header: "Valable jusqu'au", cell: (d) => formatDate(d.date_expiration) },
    { key: "total", header: "Total HT", className: "text-right tabular-nums", cell: (d) => formatAr(d.total) },
    {
      key: "statut", header: "Statut",
      cell: (d) => (
        <div className="flex flex-col items-start gap-1">
          <StatutDevis d={d} />
          {d.id_commande && can("commande.view") && (
            <Link href={`/commercial/commandes/${d.id_commande}`} className="text-xs text-muted-foreground hover:underline">
              Voir la commande
            </Link>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Devis proforma"
        description="Offres de prix aux clients. Un devis valable peut être converti en commande."
        action={
          <Can privilege="devis.create">
            <Button onClick={() => setEdition({ mode: "create" })}>
              <Plus className="mr-2 h-4 w-4" /> Nouveau devis
            </Button>
          </Can>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={liste.searchInput} onChange={liste.setSearchInput} placeholder="N° de devis ou client…" />
        <FilterSelect
          label="Année" className="w-36"
          options={[anneeCourante(), anneeCourante() - 1, anneeCourante() - 2].map((a) => ({ value: String(a), label: String(a) }))}
          value={String(liste.filters.annee ?? "")}
          onChange={(v) => liste.setFilter("annee", v)}
        />
      </div>

      <DataTable
        columns={colonnes}
        data={liste.query.data}
        isLoading={liste.query.isLoading}
        isFetching={liste.query.isFetching}
        error={liste.query.error}
        rowKey={(d) => d.id_devis}
        page={liste.page} pageSize={liste.pageSize} onPageChange={liste.setPage}
        ordering={liste.ordering} onOrderingChange={liste.setOrdering}
        emptyMessage="Aucun devis."
        actions={(d) => {
          const modifiable = !d.id_commande;
          return (
            <>
              <Button variant="ghost" size="icon" title="Détail" onClick={() => setDetail(d)}>
                <Eye className="h-4 w-4" />
              </Button>
              {modifiable && !d.est_expire && can("commande.create") && (
                <Button variant="ghost" size="icon" title="Créer la commande" onClick={() => setCommandeDe(d)}>
                  <FilePlus2 className="h-4 w-4" />
                </Button>
              )}
              {modifiable && can("devis.update") && (
                <Button variant="ghost" size="icon" title="Modifier" onClick={() => setEdition({ mode: "edit", item: d })}>
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              {can("devis.delete") && (
                <Button variant="ghost" size="icon" title="Supprimer" onClick={() => setASupprimer(d)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </>
          );
        }}
      />

      {edition && (
        <DevisDialog devis={edition.mode === "edit" ? edition.item : null} onClose={() => setEdition(null)} />
      )}

      {commandeDe && (
        <CommandeDialog
          commande={null}
          initialClientId={commandeDe.client}
          initialDevisId={commandeDe.id_devis}
          onClose={() => setCommandeDe(null)}
          onSaved={(c) => router.push(`/commercial/commandes/${c.id_commande}`)}
        />
      )}

      {detail && (
        <LignesDialog
          open
          onOpenChange={(o) => !o && setDetail(null)}
          titre={`Devis ${detail.num_devis}`}
          description={`${detail.nom_client} · valable jusqu'au ${formatDate(detail.date_expiration)} · total ${formatAr(detail.total)} HT`}
          lignes={detail.lignes.map((l) => ({
            code_produit: l.code_produit, designation: l.designation, quantite: l.quantite,
            prix: l.prix_unitaire_devis, total: l.quantite * Number(l.prix_unitaire_devis),
          }))}
        />
      )}

      <ConfirmDialog
        open={aSupprimer !== null}
        onOpenChange={(o) => !o && setASupprimer(null)}
        title="Supprimer le devis ?"
        description={`Le devis « ${aSupprimer?.num_devis ?? ""} » sera supprimé avec ses lignes. Impossible s'il a donné lieu à une commande.`}
        confirmLabel="Supprimer"
        destructive
        loading={crud.remove.isPending}
        onConfirm={supprimer}
      />
    </div>
  );
}