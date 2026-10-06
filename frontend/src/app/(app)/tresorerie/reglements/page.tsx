"use client";

import { useState } from "react";
import Link from "next/link";
import { Banknote, Landmark } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RequirePrivilege } from "@/components/can";
import { PageHeader } from "@/components/page-header";
import { DataTable, type Column } from "@/components/data/data-table";
import { DateRange } from "@/components/data/data-range";
import { FilterSelect } from "@/components/data/filter-select";
import { SearchInput } from "@/components/data/search-input";
import { StatusBadge } from "@/components/data/status-badge";
import { ReglementDialog } from "@/components/data/tresorie/reglement-dialog";
import { usePagedList } from "@/hooks/use-paged-list";
import { useAuth } from "@/lib/auth-context";
import { formatAr, formatDateTime } from "@/lib/format";
import type { Facture } from "@/types/commercial";
import { MODES_REGLEMENT, libelleMode, type Reglement } from "@/types/tresorie";

export default function ReglementsPage() {
  return (
    <RequirePrivilege privilege={["reglement.view", "reglement.encaisser", "reglement.virement"]}>
      <Contenu />
    </RequirePrivilege>
  );
}

function Contenu() {
  const { can } = useAuth();
  const onglets = [
    can("reglement.encaisser") && can("facture.view") && { id: "caisse", label: "À encaisser" },
    can("reglement.virement") && can("facture.view") && { id: "virement", label: "Virements du Trésor" },
    can("reglement.view") && { id: "historique", label: "Historique" },
  ].filter(Boolean) as { id: string; label: string }[];

  const [choix, setChoix] = useState<string | null>(null);
  const actif = onglets.find((o) => o.id === choix)?.id ?? onglets[0]?.id;
  if (!actif) return null;

  return (
    <div>
      <PageHeader
        title="Règlements"
        description="Encaissements en caisse avec quittance, virements du Trésor et historique des paiements."
      />
      <Tabs value={actif} onValueChange={setChoix}>
        <TabsList>
          {onglets.map((o) => <TabsTrigger key={o.id} value={o.id}>{o.label}</TabsTrigger>)}
        </TabsList>
        <TabsContent value="caisse" className="mt-6"><FileFactures mode="caisse" /></TabsContent>
        <TabsContent value="virement" className="mt-6"><FileFactures mode="virement" /></TabsContent>
        <TabsContent value="historique" className="mt-6"><Historique /></TabsContent>
      </Tabs>
    </div>
  );
}

/** File des factures ouvertes : à quittance (caissier) ou à virement du Trésor (comptable). */
function FileFactures({ mode }: { mode: "caisse" | "virement" }) {
  const liste = usePagedList<Facture>("commercial/factures", {
    pageSize: 10,
    ordering: "date_facture",
    refetchInterval: 8000,   // les nouvelles ventes de la réception arrivent seules
    params: {
      ouvertes: "true",
      type_facturation: mode === "caisse" ? "QUITTANCE" : "VIREMENT_TRESOR",
    },
  });
  const [cible, setCible] = useState<Facture | null>(null);

  const colonnes: Column<Facture>[] = [
    {
      key: "num", header: "Facture",
      cell: (f) => <Link href={`/commercial/factures/${f.id_facture}`} className="font-medium hover:underline">{f.num_facture}</Link>,
    },
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
    { key: "date", header: "Émise le", sortKey: "date_facture", cell: (f) => formatDateTime(f.date_facture) },
    { key: "ttc", header: "Total TTC", className: "text-right tabular-nums", cell: (f) => formatAr(f.montant_ttc) },
    { key: "regle", header: "Déjà réglé", className: "text-right tabular-nums", cell: (f) => formatAr(f.total_regle) },
    {
      key: "reste", header: "Reste à payer", className: "text-right tabular-nums font-semibold",
      cell: (f) => formatAr(f.reste_a_payer),
    },
    { key: "statut", header: "Paiement", cell: (f) => <StatusBadge statut={f.statut_paiement} /> },
  ];

  return (
    <div>
      <div className="mb-4">
        <SearchInput
          value={liste.searchInput}
          onChange={liste.setSearchInput}
          placeholder="N° de facture, commande ou client…"
        />
      </div>

      <DataTable
        columns={colonnes}
        data={liste.query.data}
        isLoading={liste.query.isLoading}
        isFetching={liste.query.isFetching}
        error={liste.query.error}
        rowKey={(f) => f.id_facture}
        page={liste.page} pageSize={liste.pageSize} onPageChange={liste.setPage}
        ordering={liste.ordering} onOrderingChange={liste.setOrdering}
        emptyMessage={mode === "caisse" ? "Aucune facture à encaisser." : "Aucun virement attendu."}
        actions={(f) => {
          const solde = Number(f.reste_a_payer) <= 0;   // facture entièrement couverte par des avoirs
          return (
            <Button
              size="sm" disabled={solde}
              title={solde ? "Aucun montant à régler (avoirs)" : undefined}
              onClick={() => setCible(f)}
            >
              {mode === "caisse" ? <Banknote className="mr-2 h-4 w-4" /> : <Landmark className="mr-2 h-4 w-4" />}
              {mode === "caisse" ? "Encaisser" : "Enregistrer le virement"}
            </Button>
          );
        }}
      />

      {cible && (
        <ReglementDialog open onOpenChange={(o) => !o && setCible(null)} facture={cible} mode={mode} />
      )}
    </div>
  );
}

function Historique() {
  const liste = usePagedList<Reglement>("tresorerie/reglements", { ordering: "-date_reglement" });

  const colonnes: Column<Reglement>[] = [
    { key: "date", header: "Date", sortKey: "date_reglement", cell: (r) => formatDateTime(r.date_reglement) },
    {
      key: "facture", header: "Facture",
      cell: (r) => <Link href={`/commercial/factures/${r.facture}`} className="font-medium hover:underline">{r.num_facture}</Link>,
    },
    { key: "mode", header: "Mode", cell: (r) => libelleMode(r.mode_reglement) },
    {
      key: "montant", header: "Montant", className: "text-right tabular-nums", sortKey: "montant_regle",
      cell: (r) => formatAr(r.montant_regle),
    },
    {
      key: "ref", header: "Quittance / virement",
      cell: (r) =>
        r.quittance
          ? `${r.quittance.numero_livre} · feuille ${r.quittance.num_feuille} · volet ${r.quittance.attribut_volet} (${r.quittance.code_caisse})`
          : (r.num_virement_tresor ?? "—"),
    },
    { key: "statut", header: "Facture", cell: (r) => <StatusBadge statut={r.statut_paiement_facture} /> },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          value={liste.searchInput}
          onChange={liste.setSearchInput}
          placeholder="N° de facture ou de virement…"
        />
        <FilterSelect
          label="Mode" options={MODES_REGLEMENT} className="w-52"
          value={String(liste.filters.mode ?? "")}
          onChange={(v) => liste.setFilter("mode", v)}
        />
        <DateRange
          du={String(liste.filters.du ?? "")}
          au={String(liste.filters.au ?? "")}
          onChange={(cle, v) => liste.setFilter(cle, v)}
        />
      </div>
      <DataTable
        columns={colonnes}
        data={liste.query.data}
        isLoading={liste.query.isLoading}
        isFetching={liste.query.isFetching}
        error={liste.query.error}
        rowKey={(r) => r.id_reglement}
        page={liste.page} pageSize={liste.pageSize} onPageChange={liste.setPage}
        ordering={liste.ordering} onOrderingChange={liste.setOrdering}
        emptyMessage="Aucun règlement."
      />
    </div>
  );
}