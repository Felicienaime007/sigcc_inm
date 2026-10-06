"use client";

import { useState } from "react";
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
import { Field } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { LotDialog } from "@/components/produits/lot-dialog";
import { usePagedList } from "@/hooks/use-paged-list";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { getErrorMessage } from "@/lib/errors";
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
  const liste = usePagedList<Lot>("produits/lots", { ordering: "-date_lancement", refetchInterval: 15000 });
  const { data: produits } = useOptions<ProduitCatalogue>("produits", { en_serie: "true" }, can("produit.view"));
  const demarrer = useRecordAction("produits/lots", "demarrer", "Production démarrée.");
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
    { key: "lot", header: "Lot", sortKey: "num_lot", cell: (l) => <span className="font-medium">{l.num_lot}</span> },
    {
      key: "produit", header: "Produit", sortKey: "produit__code_produit",
      cell: (l) => (
        <div>
          <p>{l.designation}</p>
          <p className="text-xs text-muted-foreground">{l.code_produit}</p>
        </div>
      ),
    },
    {
      key: "plage", header: "Numéros",
      cell: (l) => <span className="tabular-nums">{formatPlage(l.prefixe_serie, l.num_debut, l.num_fin)}</span>,
    },
    { key: "qte", header: "Quantité", sortKey: "quantite_lancee", className: "text-right tabular-nums", cell: (l) => formatNombre(l.quantite_lancee) },
    { key: "date", header: "Lancé le", sortKey: "date_lancement", cell: (l) => formatDateTime(l.date_lancement) },
    { key: "cmd", header: "Commande", cell: (l) => l.num_commande ?? <span className="text-muted-foreground">Stock</span> },
    { key: "statut", header: "Statut", sortKey: "statut_prod", cell: (l) => <StatusBadge statut={l.statut_prod} /> },
  ];

  const peutAgir = can("lot.update");

  return (
    <div>
      <PageHeader
        title="Lots de production"
        description="Impression des documents numérotés en série. Les numéros sont attribués automatiquement au lancement du lot."
        action={
          <Can privilege="lot.create">
            <Button onClick={() => setDialogue({ type: "creer" })}>
              <Plus className="mr-2 h-4 w-4" /> Lancer un lot
            </Button>
          </Can>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={liste.searchInput} onChange={liste.setSearchInput} placeholder="N° de lot, code ou désignation…" />
        <FilterSelect
          label="Statut" options={STATUTS_LOT}
          value={String(liste.filters.statut ?? "")}
          onChange={(v) => liste.setFilter("statut", v)}
        />
        {can("produit.view") && (
          <FilterSelect
            label="Produit" className="w-60"
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
        emptyMessage="Aucun lot."
        actions={(l) =>
          peutAgir ? (
            <>
              {l.statut_prod === "PLANIFIE" && (
                <Button variant="ghost" size="icon" title="Démarrer la production" onClick={() => setDialogue({ type: "demarrer", lot: l })}>
                  <Play className="h-4 w-4" />
                </Button>
              )}
              {l.statut_prod === "EN_COURS" && (
                <Button variant="ghost" size="icon" title="Terminer (entrée en stock)" onClick={() => setDialogue({ type: "terminer", lot: l })}>
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
              )}
              {(l.statut_prod === "PLANIFIE" || l.statut_prod === "EN_COURS") && (
                <Button variant="ghost" size="icon" title="Annuler le lot" onClick={() => setDialogue({ type: "annuler", lot: l })}>
                  <Ban className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </>
          ) : null
        }
      />

      {dialogue?.type === "creer" && <LotDialog onClose={() => setDialogue(null)} />}
      {dialogue?.type === "terminer" && <TerminerDialog lot={dialogue.lot} onClose={() => setDialogue(null)} />}
      {dialogue?.type === "annuler" && <AnnulerDialog lot={dialogue.lot} onClose={() => setDialogue(null)} />}

      <ConfirmDialog
        open={dialogue?.type === "demarrer"}
        onOpenChange={(o) => !o && setDialogue(null)}
        title="Démarrer la production ?"
        description={dialogue?.type === "demarrer"
          ? `Le lot ${dialogue.lot.num_lot} (${formatNombre(dialogue.lot.quantite_lancee)} × ${dialogue.lot.code_produit}) passe « en cours ».`
          : ""}
        confirmLabel="Démarrer"
        loading={demarrer.isPending}
        onConfirm={() => dialogue?.type === "demarrer" ? confirmerDemarrage(dialogue.lot) : undefined}
      />
    </div>
  );
}

// ---------------------------------------------------------- Fin de production
function TerminerDialog({ lot, onClose }: { lot: Lot; onClose: () => void }) {
  const { can } = useAuth();
  const [emplacement, setEmplacement] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const terminer = useApiMutation(
    async (body: unknown) => (await api.post(`/produits/lots/${lot.id_lot}/terminer/`, body)).data,
    { success: `Lot ${lot.num_lot} terminé : ${lot.quantite_lancee} exemplaire(s) entrés en stock.`, silentError: true },
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
      title={`Terminer le lot ${lot.num_lot}`}
      description={`${formatNombre(lot.quantite_lancee)} × ${lot.code_produit} (${formatPlage(lot.prefixe_serie, lot.num_debut, lot.num_fin)}) entrent en stock.`}
      onSubmit={(e) => { e?.preventDefault(); void envoyer(); }}
      submitting={terminer.isPending}
      error={erreur}
      submitLabel="Terminer et mettre en stock"
    >
      {can("emplacement.view") ? (
        <Field
          label="Emplacement de stockage"
          hint="Laissez vide pour utiliser l'emplacement le plus fourni pour ce produit (refusé s'il n'est stocké nulle part)."
        >
          <RemoteSelect<Emplacement>
            path="stock/emplacements"
            value={emplacement}
            onChange={setEmplacement}
            getValue={(e) => e.id_emplacement}
            getLabel={(e) => `${e.code_depot} · allée ${e.code_allee} · étagère ${e.code_etagere}`}
            placeholder="Emplacement habituel du produit"
            allowEmpty
            emptyLabel="— Emplacement habituel —"
          />
        </Field>
      ) : (
        <p className="text-sm text-muted-foreground">
          L'emplacement habituel du produit sera utilisé (le produit doit déjà être stocké quelque part).
        </p>
      )}
    </FormDialog>
  );
}

// ---------------------------------------------------------------- Annulation
function AnnulerDialog({ lot, onClose }: { lot: Lot; onClose: () => void }) {
  const { can } = useAuth();
  const annuler = useRecordAction("produits/lots", "annuler", "Lot annulé.");
  // Le compteur réel de la série dit si les numéros sont restitués ou perdus
  const config = useDetail<ConfigSerie>("produits/configs-serie", can("config_serie.view") ? lot.config : null);

  const plage = formatPlage(lot.prefixe_serie, lot.num_debut, lot.num_fin);
  let effet = "Les numéros du lot pourront être restitués ou perdus selon l'ordre de lancement des lots.";
  if (config.data) {
    effet =
      config.data.dernier_numero_valide === lot.num_fin
        ? `Ce lot est le dernier lancé : les numéros ${plage} sont restitués et seront réutilisés par le prochain lot.`
        : `D'autres lots ont été lancés après celui-ci : les numéros ${plage} seront définitivement perdus (trou dans la numérotation).`;
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
    <ConfirmDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Annuler le lot ${lot.num_lot} ?`}
      description={`${effet}${lot.statut_prod === "EN_COURS" ? " La production en cours est abandonnée." : ""} Cette action est définitive.`}
      confirmLabel="Annuler le lot"
      destructive
      loading={annuler.isPending}
      onConfirm={confirmer}
    />
  );
}