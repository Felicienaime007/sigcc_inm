"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, Truck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RequirePrivilege } from "@/components/can";
import { ImprimerButton } from "@/components/editions/imprimer-button";
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
import { useT } from "@/lib/i18n/contexte";
import { imprimer } from "@/lib/editions";
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
  const { t } = useT();
  const { can } = useAuth();
  // Lien profond (?bl=…) : on ouvre directement l'historique des bons.
  // Valeurs neutres au premier rendu (identiques au SSR : pas d'erreur
  // d'hydratation), l'URL n'est lue qu'après le montage.
  const [onglet, setOnglet] = useState("a-livrer");
  const [blInitial, setBlInitial] = useState("");
  useEffect(() => {
    const bl = new URLSearchParams(window.location.search).get("bl") ?? "";
    if (bl) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBlInitial(bl);
      setOnglet("bons");
    }
  }, []);
  const [cible, setCible] = useState<Cible>(null);

  const livrer = useApiMutation(
    async (c: NonNullable<Cible>) =>
      (await api.post<{ id_livraison: number; num_bl: string }>("/commercial/livraisons/", { [c.type]: c.id })).data,
    {},
  );

  async function confirmer() {
    if (!cible) return;
    try {
      const bl = await livrer.mutateAsync(cible);
      toast.success(t("commercial.livraisons.succes_bl", { x: bl.num_bl }), {
        action: { label: t("commercial.livraisons.imprimer_bl"), onClick: () => void imprimer(`livraison/${bl.id_livraison}`) },
      });
      setCible(null);
    } catch {
      /* message du serveur (ex. stock insuffisant) déjà affiché en notification : on garde le contexte */
    }
  }

  return (
    <div>
      <PageHeader
        title={t("commercial.livraisons.titre")}
        description={t("commercial.livraisons.description")}
      />

      <Tabs value={onglet} onValueChange={setOnglet}>
        <TabsList>
          {can("livraison.create") && <TabsTrigger value="a-livrer">{t("commercial.livraisons.onglet_a_livrer")}</TabsTrigger>}
          <TabsTrigger value="bons">{t("commercial.livraisons.onglet_bons")}</TabsTrigger>
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
        <TabsContent value="bons" className="mt-6"><Bons key={blInitial} initialSearch={blInitial} /></TabsContent>
      </Tabs>

      <ConfirmDialog
        open={cible !== null}
        onOpenChange={(o) => !o && setCible(null)}
        title={t("commercial.livraisons.confirm_titre")}
        description={t("commercial.livraisons.confirm_desc", { x: cible?.libelle ?? "" })}
        confirmLabel={t("commercial.livraisons.confirm_btn")}
        loading={livrer.isPending}
        onConfirm={confirmer}
      />
    </div>
  );
}

function ComptoirALivrer({ onLivrer }: { onLivrer: (f: Facture) => void }) {
  const { t } = useT();
  // Les ventes comptoir payées apparaissent ici toutes seules
  const liste = usePagedList<Facture>("commercial/factures", {
    pageSize: 10, ordering: "date_facture", params: { a_livrer: "true" }, refetchInterval: 8000,
  });
  const colonnes: Column<Facture>[] = [
    {
      key: "num", header: "commercial.livraisons.col_facture",
      cell: (f) => <Link href={`/commercial/factures/${f.id_facture}`} className="font-medium hover:underline">{f.num_facture}</Link>,
    },
    { key: "client", header: "commercial.livraisons.col_client", cell: (f) => f.nom_client },
    {
      key: "lignes", header: "commercial.livraisons.col_produits",
      cell: (f) => f.lignes.map((l) => `${l.quantite_facturee} × ${l.code_produit}`).join(", "),
    },
    { key: "ttc", header: "commercial.livraisons.col_paye", className: "text-right tabular-nums", cell: (f) => formatAr(f.montant_ttc) },
    { key: "date", header: "commercial.livraisons.col_date", cell: (f) => formatDateTime(f.date_facture) },
  ];
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{t("commercial.livraisons.section_comptoir")}</h2>
      <DataTable
        columns={colonnes}
        data={liste.query.data}
        isLoading={liste.query.isLoading}
        isFetching={liste.query.isFetching}
        error={liste.query.error}
        rowKey={(f) => f.id_facture}
        page={liste.page} pageSize={liste.pageSize} onPageChange={liste.setPage}
        emptyMessage="commercial.livraisons.vide_comptoir"
        actions={(f) => (
          <Button size="sm" onClick={() => onLivrer(f)}>
            <Truck className="mr-2 h-4 w-4" /> {t("commercial.livraisons.btn_livrer")}
          </Button>
        )}
      />
    </section>
  );
}

function PreparationsPretes({ onLivrer }: { onLivrer: (p: Preparation) => void }) {
  const { t } = useT();
  const liste = usePagedList<Preparation>("commercial/preparations", {
    pageSize: 10, ordering: "date_prepa", params: { statut: "PRETE" }, refetchInterval: 8000,
  });
  const colonnes: Column<Preparation>[] = [
    { key: "cmd", header: "commercial.livraisons.col_commande", cell: (p) => <span className="font-medium">{p.num_commande}</span> },
    { key: "client", header: "commercial.livraisons.col_client", cell: (p) => p.nom_client },
    {
      key: "lignes", header: "commercial.livraisons.col_produits",
      cell: (p) => p.lignes.map((l) => `${l.quantite_preparee} × ${l.code_produit}`).join(", "),
    },
    { key: "statut", header: "commercial.livraisons.col_statut", cell: (p) => <StatusBadge statut={p.statut_prepa} /> },
  ];
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{t("commercial.livraisons.section_pretes")}</h2>
      <DataTable
        columns={colonnes}
        data={liste.query.data}
        isLoading={liste.query.isLoading}
        isFetching={liste.query.isFetching}
        error={liste.query.error}
        rowKey={(p) => p.id_preparation}
        page={liste.page} pageSize={liste.pageSize} onPageChange={liste.setPage}
        emptyMessage="commercial.livraisons.vide_pretes"
        actions={(p) => (
          <Button size="sm" onClick={() => onLivrer(p)}>
            <Truck className="mr-2 h-4 w-4" /> {t("commercial.livraisons.btn_livrer")}
          </Button>
        )}
      />
    </section>
  );
}

function Bons({ initialSearch = "" }: { initialSearch?: string }) {
  const { t } = useT();
  // Lien profond depuis le journal des mouvements : ?bl=BL-2026-00012
  // (fourni par le parent après montage : identique au SSR au premier rendu).
  const liste = usePagedList<BonLivraison>(
    "commercial/livraisons", { ordering: "-date_livraison", initialSearch },
  );
  const [detail, setDetail] = useState<BonLivraison | null>(null);

  const colonnes: Column<BonLivraison>[] = [
    { key: "num", header: "commercial.livraisons.col_bl", sortKey: "id_livraison", cell: (b) => <span className="font-medium">{b.num_bl}</span> },
    { key: "date", header: "commercial.livraisons.col_date", sortKey: "date_livraison", cell: (b) => formatDateTime(b.date_livraison) },
    {
      key: "origine", header: "commercial.livraisons.col_origine",
      cell: (b) => (b.num_commande ? t("commercial.livraisons.origine_commande", { x: b.num_commande }) : <Badge variant="outline">{t("commercial.livraisons.origine_comptoir")}</Badge>),
    },
    { key: "client", header: "commercial.livraisons.col_client", cell: (b) => b.nom_client },
  ];

  return (
    <div>
      <div className="mb-4">
        <SearchInput value={liste.searchInput} onChange={liste.setSearchInput} placeholder={t("commercial.livraisons.ph_recherche")} />
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
        emptyMessage="commercial.livraisons.vide_bons"
        actions={(b) => (
          <ImprimerButton icone chemin={`livraison/${b.id_livraison}`} libelle={t("commercial.livraisons.imprimer_bl")} />
        )}
        rowActions={(b) => [
          { key: "detail", label: t("commercial.livraisons.detail"), icon: Eye, onSelect: () => setDetail(b) },
        ]}
      />
      {detail && (
        <LignesDialog
          open
          onOpenChange={(o) => !o && setDetail(null)}
          titre={`${t("commercial.livraisons.col_bl")} ${detail.num_bl}`}
          description={`${detail.nom_client} · ${formatDateTime(detail.date_livraison)}`}
          libelleQuantite={t("commercial.livraisons.qte_livree")}
          lignes={detail.lignes.map((l) => ({
            code_produit: l.code_produit, designation: l.designation, quantite: l.quantite_livree,
          }))}
        />
      )}
    </div>
  );
}
