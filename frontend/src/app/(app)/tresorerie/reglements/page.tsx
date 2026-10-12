"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Banknote, Landmark, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RequirePrivilege } from "@/components/can";
import { PageHeader } from "@/components/page-header";
import { Kbd } from "@/components/kbd";
import { DataTable, type Column } from "@/components/data/data-table";
import { DateRange } from "@/components/data/data-range";
import { FilterSelect } from "@/components/data/filter-select";
import { SearchInput } from "@/components/data/search-input";
import { StatusBadge } from "@/components/data/status-badge";
import { ReglementDialog } from "@/components/data/tresorie/reglement-dialog";
import { ImprimerButton } from "@/components/editions/imprimer-button";
import { DangerConfirm } from "@/components/forms/danger-confirm";
import { usePagedList } from "@/hooks/use-paged-list";
import { useAuth } from "@/lib/auth-context";
import { getErrorMessage } from "@/lib/errors";
import { formatAr, formatDateTime } from "@/lib/format";
import { useT } from "@/lib/i18n/contexte";
import { useRecordAction } from "@/lib/resource";
import type { Facture } from "@/types/commercial";
import { CLES_MODES, type Reglement } from "@/types/tresorie";

export default function ReglementsPage() {
  return (
    <RequirePrivilege privilege={["reglement.view", "reglement.encaisser", "reglement.virement"]}>
      <Contenu />
    </RequirePrivilege>
  );
}

function Contenu() {
  const { t } = useT();
  const { can } = useAuth();
  const onglets = [
    can("reglement.encaisser") && can("facture.view") && { id: "caisse", label: t("tresorerie.reglements.onglet_caisse") },
    can("reglement.virement") && can("facture.view") && { id: "virement", label: t("tresorerie.reglements.onglet_virement") },
    can("reglement.view") && { id: "historique", label: t("tresorerie.reglements.onglet_historique") },
  ].filter(Boolean) as { id: string; label: string }[];

  const [choix, setChoix] = useState<string | null>(null);
  const actif = onglets.find((o) => o.id === choix)?.id ?? onglets[0]?.id;
  if (!actif) return null;

  return (
    <div>
      <PageHeader
        title={t("tresorerie.reglements.titre")}
        description={t("tresorerie.reglements.description")}
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
  const { t } = useT();
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

  // Caisse : F9 place le curseur dans la recherche (saisie au fil de l'eau).
  useEffect(() => {
    function touches(e: KeyboardEvent) {
      if (e.key === "F9") {
        e.preventDefault();
        document.getElementById("recherche-factures")?.focus();
      }
    }
    window.addEventListener("keydown", touches);
    return () => window.removeEventListener("keydown", touches);
  }, []);
  const colonnes: Column<Facture>[] = [
    {
      key: "num", header: "tresorerie.reglements.col_facture",
      cell: (f) => <Link href={`/commercial/factures/${f.id_facture}`} className="font-medium hover:underline">{f.num_facture}</Link>,
    },
    {
      key: "client", header: "tresorerie.reglements.col_client",
      cell: (f) => (
        <div>
          <p>{f.nom_client}</p>
          <p className="text-xs text-muted-foreground">
            {f.num_commande ? t("tresorerie.reglements.commande", { num: f.num_commande }) : <Badge variant="outline">{t("tresorerie.reglements.comptoir")}</Badge>}
          </p>
        </div>
      ),
    },
    { key: "date", header: "tresorerie.reglements.col_emise", sortKey: "date_facture", cell: (f) => formatDateTime(f.date_facture) },
    { key: "ttc", header: "tresorerie.reglements.col_ttc", className: "text-right tabular-nums", cell: (f) => formatAr(f.montant_ttc) },
    { key: "regle", header: "tresorerie.reglements.col_deja", className: "text-right tabular-nums", cell: (f) => formatAr(f.total_regle) },
    {
      key: "reste", header: "tresorerie.reglements.col_reste", className: "text-right tabular-nums font-semibold",
      cell: (f) => formatAr(f.reste_a_payer),
    },
    { key: "statut", header: "tresorerie.reglements.col_paiement", cell: (f) => <StatusBadge statut={f.statut_paiement} /> },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          id="recherche-factures"
          value={liste.searchInput}
          onChange={liste.setSearchInput}
          placeholder={t("tresorerie.reglements.recherche_file")}
        />
        <p className="text-xs text-muted-foreground">
          <Kbd>F9</Kbd> {t("tresorerie.reglements.rechercher")}
        </p>
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
        emptyMessage={mode === "caisse" ? "tresorerie.reglements.vide_caisse" : "tresorerie.reglements.vide_virement"}
        actions={(f) => {
          const solde = Number(f.reste_a_payer) <= 0;   // facture entièrement couverte par des avoirs
          return (
            <Button
              size="sm" disabled={solde}
              title={solde ? t("tresorerie.reglements.rien_a_regler") : undefined}
              onClick={() => setCible(f)}
            >
              {mode === "caisse" ? <Banknote className="mr-2 h-4 w-4" /> : <Landmark className="mr-2 h-4 w-4" />}
              {mode === "caisse" ? t("tresorerie.reglements.btn_encaisser") : t("tresorerie.reglements.btn_virement")}
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
  const { t } = useT();
  const { can } = useAuth();
  const liste = usePagedList<Reglement>("tresorerie/reglements", { ordering: "-date_reglement" });
  const annuler = useRecordAction("tresorerie/reglements", "annuler", t("tresorerie.reglements.ok_annulation"));
  const [aAnnuler, setAAnnuler] = useState<Reglement | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  async function confirmerAnnulation(motif: string) {
    if (!aAnnuler) return;
    setErreur(null);
    if (!motif.trim()) return setErreur(t("tresorerie.reglements.err_motif"));
    try {
      await annuler.mutateAsync({ id: aAnnuler.id_reglement, body: { motif: motif.trim() } });
      setAAnnuler(null);
    } catch (e) {
      setErreur(getErrorMessage(e));
    }
  }

  const colonnes: Column<Reglement>[] = [
    { key: "date", header: "tresorerie.reglements.col_date", sortKey: "date_reglement", cell: (r) => formatDateTime(r.date_reglement) },
    {
      key: "facture", header: "tresorerie.reglements.col_facture",
      cell: (r) => <Link href={`/commercial/factures/${r.facture}`} className="font-medium hover:underline">{r.num_facture}</Link>,
    },
    { key: "mode", header: "tresorerie.reglements.col_mode", cell: (r) => t(CLES_MODES[r.mode_reglement] ?? r.mode_reglement) },
    {
      key: "montant", header: "tresorerie.reglements.col_montant", className: "text-right tabular-nums", sortKey: "montant_regle",
      cell: (r) => formatAr(r.montant_regle),
    },
    {
      key: "ref", header: "tresorerie.reglements.col_quittance",
      cell: (r) =>
        r.quittance ? (
          <span className="inline-flex items-center gap-2">
            <span>
              {t("tresorerie.reglements.quittance_ref", {
                numero: r.quittance.numero_livre,
                feuille: r.quittance.num_feuille,
                volet: r.quittance.attribut_volet,
                caisse: r.quittance.code_caisse,
              })}
            </span>
            {r.quittance.statut === "ANNULEE" && <StatusBadge statut="ANNULEE" />}
          </span>
        ) : (
          (r.num_virement_tresor ?? "—")
        ),
    },
    { key: "statut", header: "tresorerie.reglements.col_statut_facture", cell: (r) => <StatusBadge statut={r.statut_paiement_facture} /> },
    { key: "annulation", header: "tresorerie.reglements.col_statut", cell: (r) => <StatusBadge statut={r.statut} /> },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          value={liste.searchInput}
          onChange={liste.setSearchInput}
          placeholder={t("tresorerie.reglements.recherche_hist")}
        />
        <FilterSelect
          label={t("tresorerie.reglements.filtre_mode")}
          options={[
            { value: "ESPECES", label: t("tresorerie.modes.especes") },
            { value: "CHEQUE", label: t("tresorerie.modes.cheques") },
            { value: "VIREMENT_TRESOR", label: t("tresorerie.modes.virement_tresor") },
          ]}
          className="w-52"
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
        emptyMessage="tresorerie.reglements.vide_hist"
        actions={(r) => (
          <ImprimerButton icone chemin={`reglement/${r.id_reglement}`} libelle={t("tresorerie.reglements.imprimer_recu")} />
        )}
        rowActions={(r) =>
          can("reglement.annuler") && r.statut === "ACTIF"
            ? [{ key: "contrepasser", label: t("tresorerie.reglements.action_contrepasser"), icon: Undo2, danger: true, onSelect: () => { setErreur(null); setAAnnuler(r); } }]
            : []
        }
      />

      <DangerConfirm
        open={aAnnuler !== null}
        onOpenChange={(o) => !o && setAAnnuler(null)}
        title={t("tresorerie.reglements.contre_titre", { montant: aAnnuler ? formatAr(aAnnuler.montant_regle) : "" })}
        description={t("tresorerie.reglements.contre_desc")}
        effetFinancier={aAnnuler ? t("tresorerie.reglements.contre_effet", { montant: formatAr(aAnnuler.montant_regle), facture: aAnnuler.num_facture }) : undefined}
        requireText={aAnnuler?.num_facture ?? undefined}
        motifLabel={t("tresorerie.reglements.champ_motif")}
        motifPlaceholder={t("tresorerie.reglements.ph_motif")}
        motifRequired
        confirmLabel={t("tresorerie.reglements.contre_submit")}
        loading={annuler.isPending}
        error={erreur}
        onConfirm={(motif) => void confirmerAnnulation(motif)}
      />
    </div>
  );
}
