"use client";

import { useEffect, useState } from "react";
import { Ban, CheckCircle2, Play, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Can, RequirePrivilege } from "@/components/can";
import { PageHeader } from "@/components/page-header";
import { DataTable, type Column } from "@/components/data/data-table";
import { FilterSelect } from "@/components/data/filter-select";
import { RemoteSelect } from "@/components/data/remote-select";
import { SearchInput } from "@/components/data/search-input";
import { StatusBadge } from "@/components/data/status-badge";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { DangerConfirm } from "@/components/forms/danger-confirm";
import { Field } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { LotDialog } from "@/components/produits/lot-dialog";
import { usePagedList } from "@/hooks/use-paged-list";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { getErrorMessage } from "@/lib/errors";
import { useT } from "@/lib/i18n/contexte";
import { formatDateTime, formatNombre } from "@/lib/format";
import { STATUTS_LOT, formatPlage } from "@/lib/produits";
import { useApiMutation, useDetail, useOptions, useRecordAction } from "@/lib/resource";
import type { Emplacement } from "@/types/commercial";
import type { ConfigSerie, Lot, ProduitCatalogue } from "@/types/produits";

export default function LotsPage() {
  return (
    <RequirePrivilege privilege="lot.view">
      <Contenu />
    </RequirePrivilege>
  );
}

type Dialogue =
  | { type: "creer" }
  | { type: "demarrer"; lot: Lot }
  | { type: "terminer"; lot: Lot }
  | { type: "annuler"; lot: Lot }
  | null;

function Contenu() {
  const { can } = useAuth();
  const { t } = useT();
  const liste = usePagedList<Lot>("produits/lots", { ordering: "-date_lancement", refetchInterval: 15000 });
  const { data: produits } = useOptions<ProduitCatalogue>("produits", { en_serie: "true" }, can("produit.view"));
  const demarrer = useRecordAction("produits/lots", "demarrer", t("produits.lots.success_demarrer"));
  const [dialogue, setDialogue] = useState<Dialogue>(null);

  async function confirmerDemarrage(lot: Lot) {
    try {
      await demarrer.mutateAsync({ id: lot.id_lot });
    } catch {
      /* message du serveur déjà affiché en notification */
    }
    setDialogue(null);
  }

  const colonnes: Column<Lot>[] = [
    { key: "lot", header: "produits.lots.col_lot", sortKey: "num_lot", cell: (l) => <span className="font-medium">{l.num_lot}</span> },
    {
      key: "produit", header: "produits.lots.col_produit", sortKey: "produit__code_produit",
      cell: (l) => (
        <div>
          <p>{l.designation}</p>
          <p className="text-xs text-muted-foreground">{l.code_produit}</p>
        </div>
      ),
    },
    {
      key: "plage", header: "produits.lots.col_numeros",
      cell: (l) => <span className="tabular-nums">{formatPlage(l.prefixe_serie, l.num_debut, l.num_fin)}</span>,
    },
    { key: "qte", header: "produits.lots.col_quantite", sortKey: "quantite_lancee", className: "text-right tabular-nums", cell: (l) => formatNombre(l.quantite_lancee) },
    { key: "date", header: "produits.lots.col_lance", sortKey: "date_lancement", cell: (l) => formatDateTime(l.date_lancement) },
    { key: "cmd", header: "produits.lots.col_commande", cell: (l) => l.num_commande ?? <span className="text-muted-foreground">{t("produits.lots.badge_stock")}</span> },
    { key: "statut", header: "produits.lots.col_statut", sortKey: "statut_prod", cell: (l) => <StatusBadge statut={l.statut_prod} /> },
  ];

  const peutAgir = can("lot.update");

  return (
    <div>
      <PageHeader
        title={t("produits.lots.titre")}
        description={t("produits.lots.description")}
        action={
          <Can privilege="lot.create">
            <Button onClick={() => setDialogue({ type: "creer" })}>
              <Plus className="mr-2 h-4 w-4" /> {t("produits.lots.btn_lancer")}
            </Button>
          </Can>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={liste.searchInput} onChange={liste.setSearchInput} placeholder={t("produits.lots.ph_recherche")} />
        <FilterSelect
          label={t("produits.lots.filtre_statut")}
          options={STATUTS_LOT.map((o) => ({ value: o.value, label: t(`statuts.${o.value}`) }))}
          value={String(liste.filters.statut ?? "")}
          onChange={(v) => liste.setFilter("statut", v)}
        />
        {can("produit.view") && (
          <FilterSelect
            label={t("produits.lots.filtre_produit")} className="w-60"
            options={(produits ?? []).map((p) => ({ value: String(p.id_produit), label: `${p.code_produit} — ${p.designation}` }))}
            value={String(liste.filters.produit ?? "")}
            onChange={(v) => liste.setFilter("produit", v)}
          />
        )}
      </div>

      <DataTable
        columns={colonnes}
        data={liste.query.data}
        isLoading={liste.query.isLoading}
        isFetching={liste.query.isFetching}
        error={liste.query.error}
        rowKey={(l) => l.id_lot}
        page={liste.page} pageSize={liste.pageSize} onPageChange={liste.setPage}
        ordering={liste.ordering} onOrderingChange={liste.setOrdering}
        emptyMessage="produits.lots.vide"
        rowActions={(l) => {
          if (!peutAgir) return [];
          return [
            ...(l.statut_prod === "PLANIFIE"
              ? [{ key: "demarrer", label: t("produits.lots.act_demarrer"), icon: Play, onSelect: () => setDialogue({ type: "demarrer", lot: l }) }]
              : []),
            ...(l.statut_prod === "EN_COURS"
              ? [{ key: "terminer", label: t("produits.lots.act_terminer"), icon: CheckCircle2, onSelect: () => setDialogue({ type: "terminer", lot: l }) }]
              : []),
            ...(l.statut_prod === "PLANIFIE" || l.statut_prod === "EN_COURS"
              ? [{ key: "annuler", label: t("produits.lots.act_annuler"), icon: Ban, danger: true, onSelect: () => setDialogue({ type: "annuler", lot: l }) }]
              : []),
          ];
        }}
      />

      {dialogue?.type === "creer" && <LotDialog onClose={() => setDialogue(null)} />}
      {dialogue?.type === "terminer" && <TerminerDialog lot={dialogue.lot} onClose={() => setDialogue(null)} />}
      {dialogue?.type === "annuler" && <AnnulerDialog lot={dialogue.lot} onClose={() => setDialogue(null)} />}

      <ConfirmDialog
        open={dialogue?.type === "demarrer"}
        onOpenChange={(o) => !o && setDialogue(null)}
        title={t("produits.lots.confirm_demarrer_titre")}
        description={dialogue?.type === "demarrer"
          ? t("produits.lots.confirm_demarrer_desc", { lot: dialogue.lot.num_lot, qte: formatNombre(dialogue.lot.quantite_lancee), code: dialogue.lot.code_produit })
          : ""}
        confirmLabel={t("produits.lots.confirm_demarrer_btn")}
        loading={demarrer.isPending}
        onConfirm={() => dialogue?.type === "demarrer" ? confirmerDemarrage(dialogue.lot) : undefined}
      />
    </div>
  );
}

// ---------------------------------------------------------- Fin de production
function TerminerDialog({ lot, onClose }: { lot: Lot; onClose: () => void }) {
  const { can } = useAuth();
  const { t } = useT();
  const [emplacement, setEmplacement] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const terminer = useApiMutation(
    async (body: unknown) => (await api.post(`/produits/lots/${lot.id_lot}/terminer/`, body)).data,
    { success: t("produits.lots.success_terminer", { lot: lot.num_lot, qte: lot.quantite_lancee }), silentError: true },
  );

  async function envoyer() {
    setErreur(null);
    try {
      await terminer.mutateAsync(emplacement !== null ? { emplacement } : {});
      onClose();
    } catch (e) {
      setErreur(getErrorMessage(e));
    }
  }

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t("produits.lots.terminer_titre", { lot: lot.num_lot })}
      description={t("produits.lots.terminer_desc", { qte: formatNombre(lot.quantite_lancee), code: lot.code_produit, plage: formatPlage(lot.prefixe_serie, lot.num_debut, lot.num_fin) })}
      onSubmit={(e) => { e?.preventDefault(); void envoyer(); }}
      submitting={terminer.isPending}
      error={erreur}
      submitLabel={t("produits.lots.terminer_submit")}
    >
      {can("emplacement.view") ? (
        <Field
          label={t("produits.lots.terminer_champ")}
          hint={t("produits.lots.terminer_hint")}
        >
          <RemoteSelect<Emplacement>
            path="stock/emplacements"
            value={emplacement}
            onChange={setEmplacement}
            getValue={(e) => e.id_emplacement}
            getLabel={(e) => t("produits.lots.terminer_opt_emplacement", { depot: e.code_depot, allee: e.code_allee, etagere: e.code_etagere })}
            placeholder={t("produits.lots.terminer_ph")}
            allowEmpty
            emptyLabel={t("produits.lots.terminer_opt_habituel")}
          />
        </Field>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t("produits.lots.terminer_sans_droit")}
        </p>
      )}
    </FormDialog>
  );
}

// ---------------------------------------------------------------- Annulation
function AnnulerDialog({ lot, onClose }: { lot: Lot; onClose: () => void }) {
  const { can } = useAuth();
  const { t } = useT();
  const annuler = useRecordAction("produits/lots", "annuler", t("produits.lots.success_annuler"));
  // Le compteur réel de la série dit si les numéros sont restitués ou perdus ;
  // rechargé à chaque ouverture (un lot lancé entre-temps change la réponse).
  const config = useDetail<ConfigSerie>("produits/configs-serie", can("config_serie.view") ? lot.config : null);
  const { refetch } = config;
  useEffect(() => {
    void refetch();
  }, [refetch]);

  const plage = formatPlage(lot.prefixe_serie, lot.num_debut, lot.num_fin);
  let effet = t("produits.lots.annuler_effet_defaut");
  if (config.data) {
    effet =
      config.data.dernier_numero_valide === lot.num_fin
        ? t("produits.lots.annuler_effet_dernier", { plage })
        : t("produits.lots.annuler_effet_perdus", { plage });
  }

  async function confirmer() {
    try {
      await annuler.mutateAsync({ id: lot.id_lot });
    } catch {
      /* message du serveur déjà affiché en notification */
    }
    onClose();
  }

  return (
    <DangerConfirm
      open
      onOpenChange={(o) => !o && onClose()}
      title={t("produits.lots.annuler_titre", { lot: lot.num_lot })}
      description={t("produits.lots.annuler_desc", { effet, suffixe: lot.statut_prod === "EN_COURS" ? t("produits.lots.annuler_suffixe_encours") : "" })}
      requireText={lot.num_lot}
      confirmLabel={t("produits.lots.annuler_btn")}
      loading={annuler.isPending}
      onConfirm={confirmer}
    />
  );
}
