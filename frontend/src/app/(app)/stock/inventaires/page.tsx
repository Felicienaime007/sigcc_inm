"use client";

import Link from "next/link";
import { useState } from "react";
import { ClipboardList, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RequirePrivilege } from "@/components/can";
import { PageHeader } from "@/components/page-header";
import { DataTable, type Column } from "@/components/data/data-table";
import { FilterSelect } from "@/components/data/filter-select";
import { RemoteSelect } from "@/components/data/remote-select";
import { SearchInput } from "@/components/data/search-input";
import { StatusBadge } from "@/components/data/status-badge";
import { Field } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { usePagedList } from "@/hooks/use-paged-list";
import { useAuth } from "@/lib/auth-context";
import { getErrorMessage } from "@/lib/errors";
import { useT } from "@/lib/i18n/contexte";
import { formatDateTime } from "@/lib/format";
import { useCrud, useOptions, useRecordAction } from "@/lib/resource";
import type { Inventaire, Magasin } from "@/types/stock";

export default function InventairesPage() {
  return (
    <RequirePrivilege privilege="inventaire.view">
      <Contenu />
    </RequirePrivilege>
  );
}

function Contenu() {
  const { can } = useAuth();
  const { t } = useT();
  const liste = usePagedList<Inventaire>("stock/inventaires", { ordering: "-date_debut" });
  const crud = useCrud<Inventaire, unknown>("stock/inventaires");
  const demarrer = useRecordAction("stock/inventaires", "demarrer", t("stock.inventaires.success_demarrer"));
  const magasins = useOptions<Magasin>("stock/magasins", {}, can("magasin.view"));

  const [ouvert, setOuvert] = useState(false);
  const [magasin, setMagasin] = useState<number | null>(null);
  const [commentaire, setCommentaire] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  async function creer() {
    setErreur(null);
    if (magasin === null) return setErreur(t("stock.inventaires.err_choisir_magasin"));
    try {
      await crud.create.mutateAsync({ magasin, commentaire: commentaire.trim() || "" });
      setOuvert(false);
      setMagasin(null);
      setCommentaire("");
    } catch (e) {
      setErreur(getErrorMessage(e));
    }
  }

  const colonnes: Column<Inventaire>[] = [
    {
      key: "code", header: "stock.inventaires.col_inventaire",
      cell: (i) => <Link href={`/stock/inventaires/${i.id_inventaire}`} className="font-medium hover:underline">{i.code_inventaire}</Link>,
    },
    { key: "magasin", header: "stock.inventaires.col_magasin", cell: (i) => i.code_depot },
    { key: "debut", header: "stock.inventaires.col_debut", cell: (i) => formatDateTime(i.date_debut) },
    {
      key: "avancement", header: "stock.inventaires.col_comptage", className: "text-right tabular-nums",
      cell: (i) => `${i.nb_comptees ?? 0} / ${i.nb_lignes ?? 0}`,
    },
    { key: "statut", header: "stock.inventaires.col_statut", cell: (i) => <StatusBadge statut={i.statut} /> },
  ];

  return (
    <div>
      <PageHeader
        title={t("stock.inventaires.titre")}
        description={t("stock.inventaires.description")}
        action={
          can("inventaire.create") && (
            <Button onClick={() => { setMagasin(null); setCommentaire(""); setErreur(null); setOuvert(true); }}>
              <ClipboardList className="mr-2 h-4 w-4" /> {t("stock.inventaires.btn_nouveau")}
            </Button>
          )
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={liste.searchInput} onChange={liste.setSearchInput} placeholder={t("stock.inventaires.ph_recherche")} />
        <FilterSelect
          label={t("stock.inventaires.filtre_magasin")} className="w-52"
          options={(magasins.data ?? []).map((m) => ({ value: String(m.id_magasin), label: `${m.code_depot} — ${m.nom_magasin}` }))}
          value={String(liste.filters.magasin ?? "")}
          onChange={(v) => liste.setFilter("magasin", v)}
        />
        <FilterSelect
          label={t("stock.inventaires.filtre_statut")} className="w-48"
          options={[
            { value: "BROUILLON", label: t("stock.inventaires.opt_brouillons") },
            { value: "EN_COURS", label: t("stock.inventaires.opt_encours") },
            { value: "VALIDE", label: t("stock.inventaires.opt_valides") },
            { value: "ANNULE", label: t("stock.inventaires.opt_annules") },
          ]}
          value={String(liste.filters.statut ?? "")}
          onChange={(v) => liste.setFilter("statut", v)}
        />
      </div>

      <DataTable
        columns={colonnes}
        data={liste.query.data}
        isLoading={liste.query.isLoading}
        isFetching={liste.query.isFetching}
        error={liste.query.error}
        rowKey={(i) => i.id_inventaire}
        page={liste.page} pageSize={liste.pageSize} onPageChange={liste.setPage}
        ordering={liste.ordering} onOrderingChange={liste.setOrdering}
        emptyMessage="stock.inventaires.vide"
        actions={(i) => (
          <>
            {i.statut === "BROUILLON" && can("inventaire.update") && (
              <Button
                size="sm" disabled={demarrer.isPending}
                onClick={() => demarrer.mutate({ id: i.id_inventaire })}
              >
                <Play className="mr-2 h-4 w-4" /> {t("stock.inventaires.act_demarrer")}
              </Button>
            )}
          </>
        )}
      />

      <FormDialog
        open={ouvert}
        onOpenChange={setOuvert}
        title={t("stock.inventaires.dlg_titre")}
        description={t("stock.inventaires.dlg_desc")}
        onSubmit={(e) => { e?.preventDefault(); void creer(); }}
        submitting={crud.create.isPending}
        error={erreur}
        submitLabel={t("stock.inventaires.dlg_submit")}
      >
        <Field label={t("stock.inventaires.champ_magasin")}>
          <RemoteSelect<Magasin>
            path="stock/magasins"
            value={magasin}
            onChange={setMagasin}
            getValue={(m) => m.id_magasin}
            getLabel={(m) => `${m.code_depot} — ${m.nom_magasin}`}
            placeholder={t("stock.inventaires.ph_magasin")}
          />
        </Field>
        <Field label={t("stock.inventaires.champ_commentaire")} htmlFor="commentaire_inv" hint={t("stock.inventaires.hint_commentaire")}>
          <Input
            id="commentaire_inv" value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
          />
        </Field>
      </FormDialog>
    </div>
  );
}
