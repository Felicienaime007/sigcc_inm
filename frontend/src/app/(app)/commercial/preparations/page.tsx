"use client";

import { useState } from "react";
import { CheckCheck, Eye, PackagePlus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Can, RequirePrivilege } from "@/components/can";
import { PageHeader } from "@/components/page-header";
import { LignesDialog } from "@/components/commercial/lignes-dialog";
import { DataTable, type Column } from "@/components/data/data-table";
import { FilterSelect } from "@/components/data/filter-select";
import { RemoteSelect } from "@/components/data/remote-select";
import { SearchInput } from "@/components/data/search-input";
import { StatusBadge } from "@/components/data/status-badge";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { DangerConfirm } from "@/components/forms/danger-confirm";
import { Field } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { usePagedList } from "@/hooks/use-paged-list";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { getErrorMessage } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { useApiMutation, useCrud, useRecordAction } from "@/lib/resource";
import { useT } from "@/lib/i18n/contexte";
import type { CommandeLight, Preparation } from "@/types/commercial";

export default function PreparationsPage() {
  return (
    <RequirePrivilege privilege="preparation.view">
      <Contenu />
    </RequirePrivilege>
  );
}

function Contenu() {
  const { t } = useT();
  const { can } = useAuth();
  const liste = usePagedList<Preparation>("commercial/preparations", { ordering: "-date_prepa", refetchInterval: 10000 });
  const crud = useCrud<Preparation>("commercial/preparations");
  const reserver = useRecordAction("commercial/preparations", "reserver", t("commercial.preparations.succes_reserve"));
  const terminer = useRecordAction("commercial/preparations", "terminer", t("commercial.preparations.succes_terminee"));
  const creer = useApiMutation(
    async (commande: number) => (await api.post<Preparation>("/commercial/preparations/", { commande })).data,
    { success: t("commercial.preparations.succes_cree"), silentError: true },
  );

  const STATUTS = [
    { value: "EN_COURS", label: t("commercial.listes.prepa_en_cours") },
    { value: "PRETE", label: t("commercial.listes.prepa_prete") },
    { value: "LIVREE", label: t("commercial.listes.prepa_livree") },
  ];

  const [creation, setCreation] = useState(false);
  const [commande, setCommande] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [detail, setDetail] = useState<Preparation | null>(null);
  const [aSupprimer, setASupprimer] = useState<Preparation | null>(null);

  async function enregistrer() {
    setErreur(null);
    if (commande === null) return setErreur(t("commercial.preparations.err_choisir_commande"));
    try {
      await creer.mutateAsync(commande);
      setCreation(false);
    } catch (e) {
      setErreur(getErrorMessage(e));
    }
  }

  async function agir(action: "reserver" | "terminer", id: number) {
    try {
      await (action === "reserver" ? reserver : terminer).mutateAsync({ id });
    } catch {
      /* message du serveur (stock insuffisant, lots non terminés…) déjà affiché en notification */
    }
  }

  async function supprimer() {
    if (!aSupprimer) return;
    try {
      await crud.remove.mutateAsync(aSupprimer.id_preparation);
    } catch {
      /* 409 : des lots de production y sont liés */
    }
    setASupprimer(null);
  }

  const colonnes: Column<Preparation>[] = [
    { key: "cmd", header: "commercial.preparations.col_commande", sortKey: "commande", cell: (p) => <span className="font-medium">{p.num_commande}</span> },
    { key: "client", header: "commercial.preparations.col_client", cell: (p) => p.nom_client },
    {
      key: "lignes", header: "commercial.preparations.col_produits",
      cell: (p) => (
        <span title={p.lignes.map((l) => `${l.quantite_preparee} × ${l.designation} (${l.code_produit})`).join("\n")}>
          {p.lignes.map((l) => `${l.quantite_preparee} × ${l.designation}`).join(", ")}
        </span>
      ),
    },
    { key: "date", header: "commercial.preparations.col_creee", sortKey: "date_prepa", cell: (p) => formatDateTime(p.date_prepa) },
    { key: "statut", header: "commercial.preparations.col_statut", cell: (p) => <StatusBadge statut={p.statut_prepa} /> },
  ];

  return (
    <div>
      <PageHeader
        title={t("commercial.preparations.titre")}
        description={t("commercial.preparations.description")}
        action={
          <Can privilege="preparation.create">
            <Button onClick={() => { setCommande(null); setErreur(null); setCreation(true); }}>
              <Plus className="mr-2 h-4 w-4" /> {t("commercial.preparations.nouvelle")}
            </Button>
          </Can>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={liste.searchInput} onChange={liste.setSearchInput} placeholder={t("commercial.preparations.ph_recherche")} />
        <FilterSelect
          label={t("commercial.preparations.filtre_statut")} options={STATUTS}
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
        rowKey={(p) => p.id_preparation}
        page={liste.page} pageSize={liste.pageSize} onPageChange={liste.setPage}
        ordering={liste.ordering} onOrderingChange={liste.setOrdering}
        emptyMessage="commercial.preparations.vide"
        rowActions={(p) => [
          { key: "detail", label: t("commercial.preparations.detail"), icon: Eye, onSelect: () => setDetail(p) },
          ...(can("preparation.update") && p.statut_prepa === "EN_COURS"
            ? [
                { key: "reserver", label: t("commercial.preparations.reserver"), icon: PackagePlus, disabled: reserver.isPending, onSelect: () => agir("reserver", p.id_preparation) },
                { key: "terminer", label: t("commercial.preparations.terminer"), icon: CheckCheck, disabled: terminer.isPending, onSelect: () => agir("terminer", p.id_preparation) },
              ]
            : []),
          ...(can("preparation.delete") && p.statut_prepa !== "LIVREE"
            ? [{ key: "supprimer", label: t("commercial.preparations.supprimer"), icon: Trash2, danger: true, onSelect: () => setASupprimer(p) }]
            : []),
        ]}
      />

      {detail && (
        <LignesDialog
          open
          onOpenChange={(o) => !o && setDetail(null)}
          titre={t("commercial.preparations.dlg_titre", { x: detail.num_commande })}
          description={`${detail.nom_client} · ${formatDateTime(detail.date_prepa)}`}
          libelleQuantite={t("commercial.preparations.qte_preparee")}
          lignes={detail.lignes.map((l) => ({
            code_produit: l.code_produit, designation: l.designation, quantite: l.quantite_preparee,
          }))}
        />
      )}

      <FormDialog
        open={creation}
        onOpenChange={setCreation}
        title={t("commercial.preparations.dlg_nouvelle_titre")}
        description={t("commercial.preparations.dlg_nouvelle_desc")}
        onSubmit={(e) => { e?.preventDefault(); void enregistrer(); }}
        submitting={creer.isPending}
        error={erreur}
        submitLabel={t("commercial.preparations.dlg_nouvelle_btn")}
      >
        <Field label={t("commercial.preparations.champ_commande")}>
          <RemoteSelect<CommandeLight>
            path="commercial/commandes"
            params={{ statuts: "VALIDEE,FACTUREE" }}
            value={commande}
            onChange={setCommande}
            getValue={(c) => c.id_commande}
            getLabel={(c) => `${c.num_commande} — ${c.nom_client}`}
            placeholder={t("commercial.preparations.ph_commande")}
          />
        </Field>
      </FormDialog>

      <DangerConfirm
        open={aSupprimer !== null}
        onOpenChange={(o) => !o && setASupprimer(null)}
        title={t("commercial.preparations.confirm_titre")}
        description={t("commercial.preparations.confirm_desc")}
        confirmLabel={t("commercial.preparations.confirm_btn")}
        loading={crud.remove.isPending}
        onConfirm={supprimer}
      />
    </div>
  );
}
