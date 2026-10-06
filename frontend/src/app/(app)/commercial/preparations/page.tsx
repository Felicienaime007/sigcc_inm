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
import { Field } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { usePagedList } from "@/hooks/use-paged-list";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { getErrorMessage } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { useApiMutation, useCrud, useRecordAction } from "@/lib/resource";
import type { CommandeLight, Preparation } from "@/types/commercial";

const STATUTS = [
  { value: "EN_COURS", label: "En cours" },
  { value: "PRETE", label: "Prête" },
  { value: "LIVREE", label: "Livrée" },
];

export default function PreparationsPage() {
  return (
    <RequirePrivilege privilege="preparation.view">
      <Contenu />
    </RequirePrivilege>
  );
}

function Contenu() {
  const { can } = useAuth();
  const liste = usePagedList<Preparation>("commercial/preparations", { ordering: "-date_prepa", refetchInterval: 10000 });
  const crud = useCrud<Preparation>("commercial/preparations");
  const reserver = useRecordAction("commercial/preparations", "reserver", "Stock réservé.");
  const terminer = useRecordAction("commercial/preparations", "terminer", "Préparation prête pour la livraison.");
  const creer = useApiMutation(
    async (commande: number) => (await api.post<Preparation>("/commercial/preparations/", { commande })).data,
    { success: "Préparation créée.", silentError: true },
  );

  const [creation, setCreation] = useState(false);
  const [commande, setCommande] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [detail, setDetail] = useState<Preparation | null>(null);
  const [aSupprimer, setASupprimer] = useState<Preparation | null>(null);

  async function enregistrer() {
    setErreur(null);
    if (commande === null) return setErreur("Choisissez la commande à préparer.");
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
    { key: "cmd", header: "Commande", sortKey: "commande", cell: (p) => <span className="font-medium">{p.num_commande}</span> },
    { key: "client", header: "Client", cell: (p) => p.nom_client },
    {
      key: "lignes", header: "Produits",
      cell: (p) => p.lignes.map((l) => `${l.quantite_preparee} × ${l.code_produit}`).join(", "),
    },
    { key: "date", header: "Créée le", sortKey: "date_prepa", cell: (p) => formatDateTime(p.date_prepa) },
    { key: "statut", header: "Statut", cell: (p) => <StatusBadge statut={p.statut_prepa} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Préparations de commandes"
        description="Réservation du stock, suivi de la production et préparation avant livraison."
        action={
          <Can privilege="preparation.create">
            <Button onClick={() => { setCommande(null); setErreur(null); setCreation(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Nouvelle préparation
            </Button>
          </Can>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={liste.searchInput} onChange={liste.setSearchInput} placeholder="N° de commande ou client…" />
        <FilterSelect
          label="Statut" options={STATUTS}
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
        emptyMessage="Aucune préparation."
        actions={(p) => (
          <>
            <Button variant="ghost" size="icon" title="Détail" onClick={() => setDetail(p)}>
              <Eye className="h-4 w-4" />
            </Button>
            {can("preparation.update") && p.statut_prepa === "EN_COURS" && (
              <>
                <Button variant="ghost" size="icon" title="Réserver le stock" disabled={reserver.isPending}
                  onClick={() => agir("reserver", p.id_preparation)}>
                  <PackagePlus className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" title="Terminer la préparation" disabled={terminer.isPending}
                  onClick={() => agir("terminer", p.id_preparation)}>
                  <CheckCheck className="h-4 w-4" />
                </Button>
              </>
            )}
            {can("preparation.delete") && p.statut_prepa !== "LIVREE" && (
              <Button variant="ghost" size="icon" title="Supprimer" onClick={() => setASupprimer(p)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </>
        )}
      />

      {detail && (
        <LignesDialog
          open
          onOpenChange={(o) => !o && setDetail(null)}
          titre={`Préparation de ${detail.num_commande}`}
          description={`${detail.nom_client} · ${formatDateTime(detail.date_prepa)}`}
          libelleQuantite="Quantité préparée"
          lignes={detail.lignes.map((l) => ({
            code_produit: l.code_produit, designation: l.designation, quantite: l.quantite_preparee,
          }))}
        />
      )}

      <FormDialog
        open={creation}
        onOpenChange={setCreation}
        title="Nouvelle préparation"
        description="Les lignes de la commande sont copiées. La commande passe « en préparation »."
        onSubmit={(e) => { e?.preventDefault(); void enregistrer(); }}
        submitting={creer.isPending}
        error={erreur}
        submitLabel="Créer la préparation"
      >
        <Field label="Commande validée">
          <RemoteSelect<CommandeLight>
            path="commercial/commandes"
            params={{ statut: "VALIDEE" }}
            value={commande}
            onChange={setCommande}
            getValue={(c) => c.id_commande}
            getLabel={(c) => `${c.num_commande} — ${c.nom_client}`}
            placeholder="Choisir la commande…"
          />
        </Field>
      </FormDialog>

      <ConfirmDialog
        open={aSupprimer !== null}
        onOpenChange={(o) => !o && setASupprimer(null)}
        title="Supprimer la préparation ?"
        description="Les réservations de stock sont libérées et la commande redevient « validée ». Impossible si des lots de production y sont liés."
        confirmLabel="Supprimer"
        destructive
        loading={crud.remove.isPending}
        onConfirm={supprimer}
      />
    </div>
  );
}