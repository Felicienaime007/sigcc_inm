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
import { DangerConfirm } from "@/components/forms/danger-confirm";
import { ImprimerButton } from "@/components/editions/imprimer-button";
import { usePagedList } from "@/hooks/use-paged-list";
import { useAuth } from "@/lib/auth-context";
import { anneeCourante } from "@/lib/dates";
import { formatAr, formatDate } from "@/lib/format";
import { useCrud } from "@/lib/resource";
import { useT } from "@/lib/i18n/contexte";
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
  const { t } = useT();
  if (d.id_commande) return <Badge variant="secondary">{t("commercial.devis.statut_converti")}</Badge>;
  if (d.est_expire) return <Badge variant="destructive">{t("commercial.devis.statut_expire")}</Badge>;
  return <Badge variant="outline">{t("commercial.devis.statut_valable")}</Badge>;
}

function Contenu() {
  const { t } = useT();
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
    { key: "num", header: "commercial.devis.col_devis", sortKey: "id_devis", cell: (d) => <span className="font-medium">{d.num_devis}</span> },
    { key: "date", header: "commercial.devis.col_date", sortKey: "date_devis", cell: (d) => formatDate(d.date_devis) },
    { key: "client", header: "commercial.devis.col_client", cell: (d) => d.nom_client },
    { key: "validite", header: "commercial.devis.col_validite", cell: (d) => formatDate(d.date_expiration) },
    { key: "total", header: "commercial.devis.col_total", className: "text-right tabular-nums", cell: (d) => formatAr(d.total) },
    {
      key: "statut", header: "commercial.devis.col_statut",
      cell: (d) => (
        <div className="flex flex-col items-start gap-1">
          <StatutDevis d={d} />
          {d.id_commande && can("commande.view") && (
            <Link href={`/commercial/commandes/${d.id_commande}`} className="text-xs text-muted-foreground hover:underline">
              {t("commercial.devis.voir_commande")}
            </Link>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("commercial.devis.titre")}
        description={t("commercial.devis.description")}
        action={
          <Can privilege="devis.create">
            <Button onClick={() => setEdition({ mode: "create" })}>
              <Plus className="mr-2 h-4 w-4" /> {t("commercial.devis.nouveau")}
            </Button>
          </Can>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={liste.searchInput} onChange={liste.setSearchInput} placeholder={t("commercial.devis.ph_recherche")} />
        <FilterSelect
          label={t("commercial.devis.filtre_annee")} className="w-36"
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
        emptyMessage="commercial.devis.vide"
        actions={(d) => (
          <ImprimerButton icone chemin={`devis/${d.id_devis}`} libelle={t("commercial.devis.imprimer")} />
        )}
        rowActions={(d) => {
          const modifiable = !d.id_commande;
          return [
            { key: "detail", label: t("commercial.devis.detail"), icon: Eye, onSelect: () => setDetail(d) },
            ...(modifiable && !d.est_expire && can("commande.create")
              ? [{ key: "commande", label: t("commercial.devis.creer_commande"), icon: FilePlus2, onSelect: () => setCommandeDe(d) }]
              : []),
            ...(modifiable && can("devis.update")
              ? [{ key: "modifier", label: t("commercial.devis.modifier"), icon: Pencil, onSelect: () => setEdition({ mode: "edit", item: d }) }]
              : []),
            ...(modifiable && can("devis.delete")
              ? [{ key: "supprimer", label: t("commercial.devis.supprimer"), icon: Trash2, danger: true, onSelect: () => setASupprimer(d) }]
              : []),
          ];
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
          titre={`${t("commercial.devis.col_devis")} ${detail.num_devis}`}
          description={t("commercial.devis.detail_desc", { client: detail.nom_client, date: formatDate(detail.date_expiration), total: formatAr(detail.total) })}
          lignes={detail.lignes.map((l) => ({
            code_produit: l.code_produit, designation: l.designation, quantite: l.quantite,
            prix: l.prix_unitaire_devis, total: l.quantite * Number(l.prix_unitaire_devis),
          }))}
        />
      )}

      <DangerConfirm
        open={aSupprimer !== null}
        onOpenChange={(o) => !o && setASupprimer(null)}
        title={t("commercial.devis.confirm_titre")}
        description={t("commercial.devis.confirm_desc", { x: aSupprimer?.num_devis ?? "" })}
        requireText={aSupprimer?.num_devis ?? undefined}
        confirmLabel={t("commercial.devis.confirm_btn")}
        loading={crud.remove.isPending}
        onConfirm={supprimer}
      />
    </div>
  );
}
