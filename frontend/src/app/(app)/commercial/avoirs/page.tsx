"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, PackageCheck } from "lucide-react";
import { RequirePrivilege } from "@/components/can";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { LignesDialog } from "@/components/commercial/lignes-dialog";
import { DataTable, type Column } from "@/components/data/data-table";
import { RemoteSelect } from "@/components/data/remote-select";
import { SearchInput } from "@/components/data/search-input";
import { Field } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { usePagedList } from "@/hooks/use-paged-list";
import { useAuth } from "@/lib/auth-context";
import { getErrorMessage } from "@/lib/errors";
import { formatAr, formatDateTime } from "@/lib/format";
import { useRecordAction } from "@/lib/resource";
import type { Avoir, Emplacement } from "@/types/commercial";

export default function AvoirsPage() {
  return (
    <RequirePrivilege privilege="avoir.view">
      <Contenu />
    </RequirePrivilege>
  );
}

function Contenu() {
  const { can } = useAuth();
  const liste = usePagedList<Avoir>("commercial/avoirs", { ordering: "-date_avoir" });
  const retour = useRecordAction("commercial/avoirs", "retour-stock", "Retour en stock enregistré.");

  const [detail, setDetail] = useState<Avoir | null>(null);
  const [aRetourner, setARetourner] = useState<Avoir | null>(null);
  const [emplacement, setEmplacement] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  async function enregistrerRetour() {
    if (!aRetourner) return;
    setErreur(null);
    if (emplacement === null) return setErreur("Choisissez l'emplacement de stockage.");
    try {
      await retour.mutateAsync({ id: aRetourner.id_avoir, body: { emplacement } });
      setARetourner(null);
    } catch (e) {
      setErreur(getErrorMessage(e));
    }
  }

  const colonnes: Column<Avoir>[] = [
    { key: "num", header: "Avoir", sortKey: "id_avoir", cell: (a) => <span className="font-medium">{a.num_avoir}</span> },
    { key: "date", header: "Date", sortKey: "date_avoir", cell: (a) => formatDateTime(a.date_avoir) },
    {
      key: "facture", header: "Facture",
      cell: (a) => <Link href={`/commercial/factures/${a.facture}`} className="hover:underline">{a.num_facture}</Link>,
    },
    { key: "motif", header: "Motif", cell: (a) => <span className="line-clamp-1 max-w-xs">{a.motif}</span> },
    { key: "total", header: "Montant HT", className: "text-right tabular-nums", cell: (a) => formatAr(a.total_avoir) },
  ];

  return (
    <div>
      <PageHeader
        title="Avoirs"
        description="Corrections de factures. Un avoir se crée depuis la fiche de la facture."
      />
      <div className="mb-4">
        <SearchInput value={liste.searchInput} onChange={liste.setSearchInput} placeholder="N° d'avoir, facture ou motif…" />
      </div>

      <DataTable
        columns={colonnes}
        data={liste.query.data}
        isLoading={liste.query.isLoading}
        isFetching={liste.query.isFetching}
        error={liste.query.error}
        rowKey={(a) => a.id_avoir}
        page={liste.page} pageSize={liste.pageSize} onPageChange={liste.setPage}
        ordering={liste.ordering} onOrderingChange={liste.setOrdering}
        emptyMessage="Aucun avoir."
        actions={(a) => (
          <>
            <Button variant="ghost" size="icon" title="Détail" onClick={() => setDetail(a)}>
              <Eye className="h-4 w-4" />
            </Button>
            {can("mouvement.create") && (
              <Button
                variant="ghost" size="icon" title="Remettre en stock"
                onClick={() => { setEmplacement(null); setErreur(null); setARetourner(a); }}
              >
                <PackageCheck className="h-4 w-4" />
              </Button>
            )}
          </>
        )}
      />

      {detail && (
        <LignesDialog
          open
          onOpenChange={(o) => !o && setDetail(null)}
          titre={`Avoir ${detail.num_avoir}`}
          description={detail.motif}
          libelleQuantite="Quantité retournée"
          lignes={detail.lignes.map((l) => ({
            code_produit: l.code_produit, designation: l.designation,
            quantite: l.quantite_retournee, total: l.montant_avoir,
          }))}
        />
      )}

      <FormDialog
        open={aRetourner !== null}
        onOpenChange={(o) => !o && setARetourner(null)}
        title={`Remettre en stock : ${aRetourner?.num_avoir ?? ""}`}
        description="Toutes les quantités de l'avoir sont remises dans l'emplacement choisi. Possible une seule fois par avoir."
        onSubmit={(e) => { e?.preventDefault(); void enregistrerRetour(); }}
        submitting={retour.isPending}
        error={erreur}
        submitLabel="Remettre en stock"
      >
        <Field label="Emplacement de stockage">
          <RemoteSelect<Emplacement>
            path="stock/emplacements"
            value={emplacement}
            onChange={setEmplacement}
            getValue={(e) => e.id_emplacement}
            getLabel={(e) => `${e.code_depot} · allée ${e.code_allee} · étagère ${e.code_etagere}`}
            placeholder="Choisir l'emplacement…"
          />
        </Field>
      </FormDialog>
    </div>
  );
}