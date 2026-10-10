"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, PackageCheck, HandCoins } from "lucide-react";
import { RequirePrivilege } from "@/components/can";
import { ImprimerButton } from "@/components/editions/imprimer-button";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { LignesDialog } from "@/components/commercial/lignes-dialog";
import { DataTable, type Column } from "@/components/data/data-table";
import { RemoteSelect } from "@/components/data/remote-select";
import { SearchInput } from "@/components/data/search-input";
import { StatusBadge } from "@/components/data/status-badge";
import { Field } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { usePagedList } from "@/hooks/use-paged-list";
import { useAuth } from "@/lib/auth-context";
import { getErrorMessage } from "@/lib/errors";
import { formatAr, formatDateTime } from "@/lib/format";
import { useRecordAction } from "@/lib/resource";
import { useT } from "@/lib/i18n/contexte";
import type { Avoir, Emplacement } from "@/types/commercial";
import type { Caisse } from "@/types/tresorie";

export default function AvoirsPage() {
  return (
    <RequirePrivilege privilege="avoir.view">
      <Contenu />
    </RequirePrivilege>
  );
}

function Contenu() {
  const { t } = useT();
  const { can } = useAuth();
  const liste = usePagedList<Avoir>("commercial/avoirs", { ordering: "-date_avoir" });
  const retour = useRecordAction("commercial/avoirs", "retour-stock", t("commercial.avoirs.succes_retour"));
  const rembourser = useRecordAction("commercial/avoirs", "rembourser", t("commercial.avoirs.succes_rembourse"));

  const [detail, setDetail] = useState<Avoir | null>(null);
  const [aRetourner, setARetourner] = useState<Avoir | null>(null);
  const [emplacement, setEmplacement] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [aRembourser, setARembourser] = useState<Avoir | null>(null);
  const [caisse, setCaisse] = useState<number | null>(null);
  const [erreurRemboursement, setErreurRemboursement] = useState<string | null>(null);

  async function enregistrerRetour() {
    if (!aRetourner) return;
    setErreur(null);
    if (emplacement === null) return setErreur(t("commercial.avoirs.err_emplacement"));
    try {
      await retour.mutateAsync({ id: aRetourner.id_avoir, body: { emplacement } });
      setARetourner(null);
    } catch (e) {
      setErreur(getErrorMessage(e));
    }
  }

  async function enregistrerRemboursement() {
    if (!aRembourser) return;
    setErreurRemboursement(null);
    if (caisse === null) return setErreurRemboursement(t("commercial.avoirs.err_caisse"));
    try {
      await rembourser.mutateAsync({ id: aRembourser.id_avoir, body: { caisse } });
      setARembourser(null);
    } catch (e) {
      setErreurRemboursement(getErrorMessage(e));
    }
  }

  const colonnes: Column<Avoir>[] = [
    { key: "num", header: "commercial.avoirs.col_avoir", sortKey: "id_avoir", cell: (a) => <span className="font-medium">{a.num_avoir}</span> },
    { key: "date", header: "commercial.avoirs.col_date", sortKey: "date_avoir", cell: (a) => formatDateTime(a.date_avoir) },
    {
      key: "facture", header: "commercial.avoirs.col_facture",
      cell: (a) => <Link href={`/commercial/factures/${a.facture}`} className="hover:underline">{a.num_facture}</Link>,
    },
    { key: "motif", header: "commercial.avoirs.col_motif", cell: (a) => <span className="line-clamp-1 max-w-xs">{a.motif}</span> },
    { key: "total", header: "commercial.avoirs.col_total", className: "text-right tabular-nums", cell: (a) => formatAr(a.total_avoir) },
    { key: "remboursement", header: "commercial.avoirs.col_remboursement", cell: (a) => <StatusBadge statut={a.statut_remboursement} /> },
  ];

  return (
    <div>
      <PageHeader
        title={t("commercial.avoirs.titre")}
        description={t("commercial.avoirs.description")}
      />
      <div className="mb-4">
        <SearchInput value={liste.searchInput} onChange={liste.setSearchInput} placeholder={t("commercial.avoirs.ph_recherche")} />
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
        emptyMessage="commercial.avoirs.vide"
        actions={(a) => (
          <>
            <ImprimerButton icone chemin={`avoir/${a.id_avoir}`} libelle={t("commercial.avoirs.imprimer")} />
            <Button variant="ghost" size="icon" title={t("commercial.avoirs.detail")} aria-label={t("commercial.avoirs.detail")} onClick={() => setDetail(a)}>
              <Eye className="h-4 w-4" />
            </Button>
            {can("mouvement.create") && (
              <Button
                variant="ghost" size="icon" title={t("commercial.avoirs.remettre")} aria-label={t("commercial.avoirs.remettre")}
                onClick={() => { setEmplacement(null); setErreur(null); setARetourner(a); }}
              >
                <PackageCheck className="h-4 w-4" />
              </Button>
            )}
            {can("avoir.rembourser") && a.statut_remboursement === "A_REMBOURSER" && (
              <Button
                variant="ghost" size="icon" title={t("commercial.avoirs.rembourser")} aria-label={t("commercial.avoirs.rembourser")}
                onClick={() => { setCaisse(null); setErreurRemboursement(null); setARembourser(a); }}
              >
                <HandCoins className="h-4 w-4" />
              </Button>
            )}
          </>
        )}
      />

      {detail && (
        <LignesDialog
          open
          onOpenChange={(o) => !o && setDetail(null)}
          titre={`${t("commercial.avoirs.col_avoir")} ${detail.num_avoir}`}
          description={detail.motif}
          libelleQuantite={t("commercial.avoirs.qte_retournee")}
          lignes={detail.lignes.map((l) => ({
            code_produit: l.code_produit, designation: l.designation,
            quantite: l.quantite_retournee, total: l.montant_avoir,
          }))}
        />
      )}

      <FormDialog
        open={aRetourner !== null}
        onOpenChange={(o) => !o && setARetourner(null)}
        title={t("commercial.avoirs.dlg_retour_titre", { x: aRetourner?.num_avoir ?? "" })}
        description={t("commercial.avoirs.dlg_retour_desc")}
        onSubmit={(e) => { e?.preventDefault(); void enregistrerRetour(); }}
        submitting={retour.isPending}
        error={erreur}
        submitLabel={t("commercial.avoirs.dlg_retour_btn")}
      >
        <Field label={t("commercial.avoirs.champ_emplacement")}>
          <RemoteSelect<Emplacement>
            path="stock/emplacements"
            value={emplacement}
            onChange={setEmplacement}
            getValue={(e) => e.id_emplacement}
            getLabel={(e) => t("commercial.avoirs.emplacement_label", { depot: e.code_depot, allee: e.code_allee, etagere: e.code_etagere })}
            placeholder={t("commercial.avoirs.ph_emplacement")}
          />
        </Field>
      </FormDialog>

      <FormDialog
        open={aRembourser !== null}
        onOpenChange={(o) => !o && setARembourser(null)}
        title={t("commercial.avoirs.dlg_remb_titre", { x: aRembourser?.num_avoir ?? "" })}
        description={t("commercial.avoirs.dlg_remb_desc")}
        onSubmit={(e) => { e?.preventDefault(); void enregistrerRemboursement(); }}
        submitting={rembourser.isPending}
        error={erreurRemboursement}
        submitLabel={t("commercial.avoirs.dlg_remb_btn")}
      >
        <Field label={t("commercial.avoirs.champ_caisse")}>
          <RemoteSelect<Caisse>
            path="tresorerie/caisses"
            value={caisse}
            onChange={setCaisse}
            getValue={(c) => c.id_caisse}
            getLabel={(c) => `${c.code_caisse} — ${c.libelle_caisse} (${formatAr(c.solde_actuel)})`}
            placeholder={t("commercial.avoirs.ph_caisse")}
          />
        </Field>
      </FormDialog>
    </div>
  );
}
