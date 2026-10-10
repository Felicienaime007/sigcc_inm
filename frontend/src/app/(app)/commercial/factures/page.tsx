"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, Receipt} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { RequirePrivilege } from "@/components/can";
import { ImprimerButton } from "@/components/editions/imprimer-button";
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
import { useT } from "@/lib/i18n/contexte";
import type { CommandeLight, Facture } from "@/types/commercial";



export default function FacturesPage() {
  return (
    <RequirePrivilege privilege="facture.view">
      <Contenu />
    </RequirePrivilege>
  );
}

function Contenu() {
  const { t } = useT();
  const { can } = useAuth();
  // Rafraîchissement automatique : le caissier et la réception voient l'évolution des paiements
  const liste = usePagedList<Facture>("commercial/factures", { ordering: "-date_facture", refetchInterval: 8000 });

  const [facturer, setFacturer] = useState(false);
  const [commande, setCommande] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const facturerCommande = useApiMutation(
    async (id: number) => (await api.post<Facture>("/commercial/factures/", { commande: id })).data,
    { success: t("commercial.factures.succes_cree"), silentError: true },
  );

  async function envoyer() {
    setErreur(null);
    if (commande === null) return setErreur(t("commercial.factures.err_choisir_commande"));
    try {
      await facturerCommande.mutateAsync(commande);
      setFacturer(false);
    } catch (e) {
      setErreur(getErrorMessage(e));
    }
  }

  const colonnes: Column<Facture>[] = [
    {
      key: "num", header: "commercial.factures.col_facture", sortKey: "id_facture",
      cell: (f) => (
        <Link href={`/commercial/factures/${f.id_facture}`} className="font-medium hover:underline">
          {f.num_facture}
        </Link>
      ),
    },
    { key: "date", header: "commercial.factures.col_date", sortKey: "date_facture", cell: (f) => formatDateTime(f.date_facture) },
    {
      key: "client", header: "commercial.factures.col_client",
      cell: (f) => (
        <div>
          <p>{f.nom_client}</p>
          <p className="text-xs text-muted-foreground">
            {f.num_commande ? t("commercial.factures.commande_prefixe", { x: f.num_commande }) : <Badge variant="outline">{t("commercial.factures.comptoir")}</Badge>}
          </p>
        </div>
      ),
    },
    {
      key: "ttc", header: "commercial.factures.col_ttc", className: "text-right tabular-nums",
      cell: (f) => formatAr(f.montant_ttc),
    },
    {
      key: "reste", header: "commercial.factures.col_reste", className: "text-right tabular-nums",
      cell: (f) => formatAr(f.reste_a_payer),
    },
    { key: "type", header: "commercial.factures.col_mode", cell: (f) => libelleFacturation(f.type_facturation, t) },
    { key: "statut", header: "commercial.factures.col_paiement", cell: (f) => <StatusBadge statut={f.statut_paiement} /> },
  ];

  return (
    <div>
      <PageHeader
        title={t("commercial.factures.titre")}
        description={t("commercial.factures.description")}
        action={
          can("facture.create") && can("commande.view") && (
            <Button onClick={() => { setCommande(null); setErreur(null); setFacturer(true); }}>
              <Receipt className="mr-2 h-4 w-4" /> {t("commercial.factures.facturer_commande")}
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          value={liste.searchInput}
          onChange={liste.setSearchInput}
          placeholder={t("commercial.factures.ph_recherche")}
        />
        <FilterSelect
          label={t("commercial.factures.filtre_paiement")} options={STATUTS_PAIEMENT.map((o) => ({ value: o.value, label: t(o.label) }))}
          value={String(liste.filters.statut ?? "")}
          onChange={(v) => liste.setFilter("statut", v)}
        />
        <FilterSelect
          label={t("commercial.factures.filtre_mode")} options={TYPES_FACTURATION.map((o) => ({ value: o.value, label: t(o.label) }))} className="w-52"
          value={String(liste.filters.type_facturation ?? "")}
          onChange={(v) => liste.setFilter("type_facturation", v)}
        />
        <FilterSelect
          label={t("commercial.factures.filtre_origine")} className="w-48"
          options={[
            { value: "true", label: t("commercial.factures.origine_comptoir") },
            { value: "false", label: t("commercial.factures.origine_commande") },
          ]}
          value={String(liste.filters.comptoir ?? "")}
          onChange={(v) => liste.setFilter("comptoir", v)}
        />
        <FilterSelect
          label={t("commercial.factures.filtre_livraison")} className="w-44"
          options={[{ value: "true", label: t("commercial.factures.filtre_a_livrer") }]}
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
        emptyMessage="commercial.factures.vide"
        actions={(f) => (
          <>
            <ImprimerButton icone chemin={`facture/${f.id_facture}`} libelle={t("commercial.factures.imprimer")} />
            <Link
              href={`/commercial/factures/${f.id_facture}`}
              className={buttonVariants({ variant: "ghost", size: "icon" })}
              title={t("commercial.factures.voir")}
            >
              <Eye className="h-4 w-4" />
            </Link>
          </>
        )}
      />

      <FormDialog
        open={facturer}
        onOpenChange={setFacturer}
        title={t("commercial.factures.dlg_titre")}
        description={t("commercial.factures.dlg_description")}
        onSubmit={(e) => { e?.preventDefault(); void envoyer(); }}
        submitting={facturerCommande.isPending}
        error={erreur}
        submitLabel={t("commercial.factures.dlg_valider")}
      >
        <Field label={t("commercial.factures.champ_commande")}>
          <RemoteSelect<CommandeLight>
            path="commercial/commandes"
            params={{ statut: "LIVREE" }}
            value={commande}
            onChange={setCommande}
            getValue={(c) => c.id_commande}
            getLabel={(c) => `${c.num_commande} — ${c.nom_client}`}
            placeholder={t("commercial.factures.ph_commande")}
          />
        </Field>
      </FormDialog>
    </div>
  );
}
