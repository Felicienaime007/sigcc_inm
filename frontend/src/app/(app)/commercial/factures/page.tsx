"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Receipt} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { STATUTS_PAIEMENT, TYPES_FACTURATION, libelleFacturation } from "@/lib/commercial";
import { getErrorMessage } from "@/lib/errors";
import { formatAr, formatDateTime } from "@/lib/format";
import { useApiMutation } from "@/lib/resource";
import type { CommandeLight, Facture } from "@/types/commercial";



export default function FacturesPage() {
  return (
    <RequirePrivilege privilege="facture.view">
      <Contenu />
    </RequirePrivilege>
  );
}

function Contenu() {
  const router = useRouter();
  const { can } = useAuth();
  // Rafraîchissement automatique : le caissier et la réception voient l'évolution des paiements
  const liste = usePagedList<Facture>("commercial/factures", { ordering: "-date_facture", refetchInterval: 8000 });

  const [facturer, setFacturer] = useState(false);
  const [commande, setCommande] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const facturerCommande = useApiMutation(
    async (id: number) => (await api.post<Facture>("/commercial/factures/", { commande: id })).data,
    { success: "Facture créée.", silentError: true },
  );

  async function envoyer() {
    setErreur(null);
    if (commande === null) return setErreur("Choisissez la commande à facturer.");
    try {
      await facturerCommande.mutateAsync(commande);
      setFacturer(false);
    } catch (e) {
      setErreur(getErrorMessage(e));
    }
  }

  const colonnes: Column<Facture>[] = [
    {
      key: "num", header: "Facture", sortKey: "id_facture",
      cell: (f) => (
        <Link href={`/commercial/factures/${f.id_facture}`} className="font-medium hover:underline">
          {f.num_facture}
        </Link>
      ),
    },
    { key: "date", header: "Date", sortKey: "date_facture", cell: (f) => formatDateTime(f.date_facture) },
    {
      key: "client", header: "Client",
      cell: (f) => (
        <div>
          <p>{f.nom_client}</p>
          <p className="text-xs text-muted-foreground">
            {f.num_commande ? `Commande ${f.num_commande}` : <Badge variant="outline">Comptoir</Badge>}
          </p>
        </div>
      ),
    },
    {
      key: "ttc", header: "Total TTC", className: "text-right tabular-nums",
      cell: (f) => formatAr(f.montant_ttc),
    },
    {
      key: "reste", header: "Reste à payer", className: "text-right tabular-nums",
      cell: (f) => formatAr(f.reste_a_payer),
    },
    { key: "type", header: "Mode", cell: (f) => libelleFacturation(f.type_facturation) },
    { key: "statut", header: "Paiement", cell: (f) => <StatusBadge statut={f.statut_paiement} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Factures"
        description="Ventes comptoir et factures de commandes livrées. Mise à jour automatique."
        action={
          can("facture.create") && can("commande.view") && (
            <Button onClick={() => { setCommande(null); setErreur(null); setFacturer(true); }}>
              <Receipt className="mr-2 h-4 w-4" /> Facturer une commande
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          value={liste.searchInput}
          onChange={liste.setSearchInput}
          placeholder="N° de facture, commande ou client…"
        />
        <FilterSelect
          label="Paiement" options={STATUTS_PAIEMENT}
          value={String(liste.filters.statut ?? "")}
          onChange={(v) => liste.setFilter("statut", v)}
        />
        <FilterSelect
          label="Mode" options={TYPES_FACTURATION} className="w-52"
          value={String(liste.filters.type_facturation ?? "")}
          onChange={(v) => liste.setFilter("type_facturation", v)}
        />
        <FilterSelect
          label="Origine" className="w-48"
          options={[
            { value: "true", label: "Comptoir" },
            { value: "false", label: "Commande" },
          ]}
          value={String(liste.filters.comptoir ?? "")}
          onChange={(v) => liste.setFilter("comptoir", v)}
        />
        <FilterSelect
          label="Livraison" className="w-44"
          options={[{ value: "true", label: "À livrer" }]}
          value={String(liste.filters.a_livrer ?? "")}
          onChange={(v) => liste.setFilter("a_livrer", v)}
        />
      </div>

      <DataTable
        columns={colonnes}
        data={liste.query.data}
        isLoading={liste.query.isLoading}
        isFetching={liste.query.isFetching}
        error={liste.query.error}
        rowKey={(f) => f.id_facture}
        page={liste.page}
        pageSize={liste.pageSize}
        onPageChange={liste.setPage}
        ordering={liste.ordering}
        onOrderingChange={liste.setOrdering}
        emptyMessage="Aucune facture."
        actions={(f) => (
          <Button variant="ghost" size="icon" title="Voir" onClick={() => router.push(`/commercial/factures/${f.id_facture}`)}>
            <Eye className="h-4 w-4" />
          </Button>
        )}
      />

      <FormDialog
        open={facturer}
        onOpenChange={setFacturer}
        title="Facturer une commande livrée"
        description="La facture reprend les quantités du bon de livraison et les prix de la commande."
        onSubmit={(e) => { e?.preventDefault(); void envoyer(); }}
        submitting={facturerCommande.isPending}
        error={erreur}
        submitLabel="Créer la facture"
      >
        <Field label="Commande livrée">
          <RemoteSelect<CommandeLight>
            path="commercial/commandes"
            params={{ statut: "LIVREE" }}
            value={commande}
            onChange={setCommande}
            getValue={(c) => c.id_commande}
            getLabel={(c) => `${c.num_commande} — ${c.nom_client}`}
            placeholder="Choisir la commande…"
          />
        </Field>
      </FormDialog>
    </div>
  );
}