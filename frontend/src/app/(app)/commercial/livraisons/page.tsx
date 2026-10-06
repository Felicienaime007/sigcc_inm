"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RequirePrivilege } from "@/components/can";
import { PageHeader } from "@/components/page-header";
import { LignesDialog } from "@/components/commercial/lignes-dialog";
import { DataTable, type Column } from "@/components/data/data-table";
import { SearchInput } from "@/components/data/search-input";
import { StatusBadge } from "@/components/data/status-badge";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { usePagedList } from "@/hooks/use-paged-list";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatAr, formatDateTime } from "@/lib/format";
import { useApiMutation } from "@/lib/resource";
import type { BonLivraison, Facture, Preparation } from "@/types/commercial";

export default function LivraisonsPage() {
  return (
    <RequirePrivilege privilege="livraison.view">
      <Contenu />
    </RequirePrivilege>
  );
}

type Cible = { type: "facture"; id: number; libelle: string } | { type: "preparation"; id: number; libelle: string } | null;

function Contenu() {
  const { can } = useAuth();
  const [onglet, setOnglet] = useState("a-livrer");
  const [cible, setCible] = useState<Cible>(null);

  const livrer = useApiMutation(
    async (c: NonNullable<Cible>) =>
      (await api.post("/commercial/livraisons/", { [c.type]: c.id })).data,
    { success: "Bon de livraison créé, stock mis à jour." },
  );

  async function confirmer() {
    if (!cible) return;
    try {
      await livrer.mutateAsync(cible);
    } catch {
      /* message du serveur (ex. stock insuffisant) déjà affiché en notification */
    }
    setCible(null);
  }

  return (
    <div>
      <PageHeader
        title="Livraisons"
        description="Sorties de marchandises : ventes comptoir payées, commandes préparées, et historique des bons de livraison."
      />

      <Tabs value={onglet} onValueChange={setOnglet}>
        <TabsList>
          {can("livraison.create") && <TabsTrigger value="a-livrer">À livrer</TabsTrigger>}
          <TabsTrigger value="bons">Bons de livraison</TabsTrigger>
        </TabsList>

        {can("livraison.create") && (
          <TabsContent value="a-livrer" className="mt-6 space-y-8">
            <ComptoirALivrer onLivrer={(f) => setCible({ type: "facture", id: f.id_facture, libelle: f.num_facture })} />
            {can("preparation.view") && (
              <PreparationsPretes
                onLivrer={(p) => setCible({ type: "preparation", id: p.id_preparation, libelle: p.num_commande })}
              />
            )}
          </TabsContent>
        )}
        <TabsContent value="bons" className="mt-6"><Bons /></TabsContent>
      </Tabs>

      <ConfirmDialog
        open={cible !== null}
        onOpenChange={(o) => !o && setCible(null)}
        title="Confirmer la livraison ?"
        description={`Un bon de livraison est créé pour ${cible?.libelle ?? ""} et les produits sortent du stock. Cette action ne s'annule pas.`}
        confirmLabel="Livrer"
        loading={livrer.isPending}
        onConfirm={confirmer}
      />
    </div>
  );
}

function ComptoirALivrer({ onLivrer }: { onLivrer: (f: Facture) => void }) {
  // Les ventes comptoir payées apparaissent ici toutes seules
  const liste = usePagedList<Facture>("commercial/factures", {
    pageSize: 10, ordering: "date_facture", params: { a_livrer: "true" }, refetchInterval: 8000,
  });
  const colonnes: Column<Facture>[] = [
    {
      key: "num", header: "Facture",
      cell: (f) => <Link href={`/commercial/factures/${f.id_facture}`} className="font-medium hover:underline">{f.num_facture}</Link>,
    },
    { key: "client", header: "Client", cell: (f) => f.nom_client },
    {
      key: "lignes", header: "Produits",
      cell: (f) => f.lignes.map((l) => `${l.quantite_facturee} × ${l.code_produit}`).join(", "),
    },
    { key: "ttc", header: "Payé", className: "text-right tabular-nums", cell: (f) => formatAr(f.montant_ttc) },
    { key: "date", header: "Date", cell: (f) => formatDateTime(f.date_facture) },
  ];
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Ventes comptoir payées, à livrer</h2>
      <DataTable
        columns={colonnes}
        data={liste.query.data}
        isLoading={liste.query.isLoading}
        isFetching={liste.query.isFetching}
        error={liste.query.error}
        rowKey={(f) => f.id_facture}
        page={liste.page} pageSize={liste.pageSize} onPageChange={liste.setPage}
        emptyMessage="Aucune vente comptoir en attente de livraison."
        actions={(f) => (
          <Button size="sm" onClick={() => onLivrer(f)}>
            <Truck className="mr-2 h-4 w-4" /> Livrer
          </Button>
        )}
      />
    </section>
  );
}

function PreparationsPretes({ onLivrer }: { onLivrer: (p: Preparation) => void }) {
  const liste = usePagedList<Preparation>("commercial/preparations", {
    pageSize: 10, ordering: "date_prepa", params: { statut: "PRETE" }, refetchInterval: 8000,
  });
  const colonnes: Column<Preparation>[] = [
    { key: "cmd", header: "Commande", cell: (p) => <span className="font-medium">{p.num_commande}</span> },
    { key: "client", header: "Client", cell: (p) => p.nom_client },
    {
      key: "lignes", header: "Produits",
      cell: (p) => p.lignes.map((l) => `${l.quantite_preparee} × ${l.code_produit}`).join(", "),
    },
    { key: "statut", header: "Statut", cell: (p) => <StatusBadge statut={p.statut_prepa} /> },
  ];
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Commandes préparées, à livrer</h2>
      <DataTable
        columns={colonnes}
        data={liste.query.data}
        isLoading={liste.query.isLoading}
        isFetching={liste.query.isFetching}
        error={liste.query.error}
        rowKey={(p) => p.id_preparation}
        page={liste.page} pageSize={liste.pageSize} onPageChange={liste.setPage}
        emptyMessage="Aucune préparation prête."
        actions={(p) => (
          <Button size="sm" onClick={() => onLivrer(p)}>
            <Truck className="mr-2 h-4 w-4" /> Livrer
          </Button>
        )}
      />
    </section>
  );
}

function Bons() {
  const liste = usePagedList<BonLivraison>("commercial/livraisons", { ordering: "-date_livraison" });
  const [detail, setDetail] = useState<BonLivraison | null>(null);

  const colonnes: Column<BonLivraison>[] = [
    { key: "num", header: "Bon de livraison", sortKey: "id_livraison", cell: (b) => <span className="font-medium">{b.num_bl}</span> },
    { key: "date", header: "Date", sortKey: "date_livraison", cell: (b) => formatDateTime(b.date_livraison) },
    {
      key: "origine", header: "Origine",
      cell: (b) => (b.num_commande ? `Commande ${b.num_commande}` : <Badge variant="outline">Comptoir</Badge>),
    },
    { key: "client", header: "Client", cell: (b) => b.nom_client },
  ];

  return (
    <div>
      <div className="mb-4">
        <SearchInput value={liste.searchInput} onChange={liste.setSearchInput} placeholder="N° de BL, commande ou facture…" />
      </div>
      <DataTable
        columns={colonnes}
        data={liste.query.data}
        isLoading={liste.query.isLoading}
        isFetching={liste.query.isFetching}
        error={liste.query.error}
        rowKey={(b) => b.id_livraison}
        page={liste.page} pageSize={liste.pageSize} onPageChange={liste.setPage}
        ordering={liste.ordering} onOrderingChange={liste.setOrdering}
        emptyMessage="Aucun bon de livraison."
        actions={(b) => (
          <Button variant="ghost" size="icon" title="Détail" onClick={() => setDetail(b)}>
            <Eye className="h-4 w-4" />
          </Button>
        )}
      />
      {detail && (
        <LignesDialog
          open
          onOpenChange={(o) => !o && setDetail(null)}
          titre={`Bon de livraison ${detail.num_bl}`}
          description={`${detail.nom_client} · ${formatDateTime(detail.date_livraison)}`}
          libelleQuantite="Quantité livrée"
          lignes={detail.lignes.map((l) => ({
            code_produit: l.code_produit, designation: l.designation, quantite: l.quantite_livree,
          }))}
        />
      )}
    </div>
  );
}