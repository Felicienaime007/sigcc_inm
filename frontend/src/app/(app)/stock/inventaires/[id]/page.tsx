"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Loader2, Play, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RequirePrivilege } from "@/components/can";
import { PageHeader } from "@/components/page-header";
import { DataTable, type Column } from "@/components/data/data-table";
import { FilterSelect } from "@/components/data/filter-select";
import { SearchInput } from "@/components/data/search-input";
import { StatusBadge } from "@/components/data/status-badge";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { usePagedList } from "@/hooks/use-paged-list";
import { useAuth } from "@/lib/auth-context";
import { getErrorMessage } from "@/lib/errors";
import { useT } from "@/lib/i18n/contexte";
import { formatDateTime, formatNombre } from "@/lib/format";
import { useDetail, useRecordAction } from "@/lib/resource";
import { api } from "@/lib/api";
import { getErrorMessageAsync } from "@/lib/errors";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Inventaire, LigneInventaire } from "@/types/stock";

export default function InventaireDetailPage() {
  return (
    <RequirePrivilege privilege="inventaire.view">
      <Contenu />
    </RequirePrivilege>
  );
}

function Contenu() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const { t } = useT();
  const qc = useQueryClient();
  const { data: inventaire, isLoading, error } = useDetail<Inventaire>("stock/inventaires", id);
  const liste = usePagedList<LigneInventaire>("stock/lignes-inventaire", {
    ordering: "produit__code_produit",
    params: { inventaire: id ?? "" },
    pageSize: 15,
  });
  const demarrer = useRecordAction("stock/inventaires", "demarrer", t("stock.inventaire_detail.success_demarrer"));
  const valider = useRecordAction("stock/inventaires", "valider", t("stock.inventaire_detail.success_valider"));
  const annuler = useRecordAction("stock/inventaires", "annuler", t("stock.inventaire_detail.success_annuler"));

  const [dialogue, setDialogue] = useState<"valider" | "annuler" | null>(null);
  const [saisies, setSaisies] = useState<Record<number, string>>({});
  const [enCours, setEnCours] = useState<number | null>(null);

  if (isLoading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (error || !inventaire) {
    return (
      <div className="space-y-3 py-16 text-center">
        <p className="text-destructive">{getErrorMessage(error, t("stock.inventaire_detail.err_introuvable"))}</p>
        <Link href="/stock/inventaires" className="text-sm text-muted-foreground hover:text-foreground">
          {t("stock.inventaire_detail.retour")}
        </Link>
      </div>
    );
  }

  const enCoursStatut = inventaire.statut === "EN_COURS";
  const peutSaisir = enCoursStatut && can("inventaire.update");

  async function enregistrer(ligne: LigneInventaire) {
    const brut = (saisies[ligne.id_ligne_inventaire] ?? "").trim();
    if (brut === "" || !/^\d+$/.test(brut)) return;
    setEnCours(ligne.id_ligne_inventaire);
    try {
      await api.patch(`/stock/lignes-inventaire/${ligne.id_ligne_inventaire}/`, {
        quantite_comptee: Number(brut),
      });
      setSaisies((s) => {
        const copie = { ...s };
        delete copie[ligne.id_ligne_inventaire];
        return copie;
      });
      void qc.invalidateQueries();
    } catch (e) {
      toast.error(await getErrorMessageAsync(e, t("stock.inventaire_detail.err_comptage")));
    } finally {
      setEnCours(null);
    }
  }

  const colonnes: Column<LigneInventaire>[] = [
    {
      key: "produit", header: "stock.inventaire_detail.col_produit",
      cell: (l) => (
        <div>
          <p className="font-medium">{l.designation}</p>
          <p className="text-xs text-muted-foreground">{l.code_produit} · {l.libelle_emplacement}</p>
        </div>
      ),
    },
    { key: "theorique", header: "stock.inventaire_detail.col_theorique", className: "text-right tabular-nums", cell: (l) => formatNombre(l.quantite_theorique) },
    {
      key: "compte", header: "stock.inventaire_detail.col_compte", className: "text-right tabular-nums",
      cell: (l) => (l.quantite_comptee === null ? <span className="text-muted-foreground">—</span> : formatNombre(l.quantite_comptee)),
    },
    {
      key: "ecart", header: "stock.inventaire_detail.col_ecart", className: "text-right tabular-nums font-semibold",
      cell: (l) => (
        l.ecart === null ? <span className="text-muted-foreground">—</span>
          : <span className={cn(l.ecart === 0 ? "text-green-700" : "text-destructive")}>
            {l.ecart > 0 ? `+${formatNombre(l.ecart)}` : formatNombre(l.ecart)}
          </span>
      ),
    },
    {
      key: "saisie", header: "stock.inventaire_detail.col_saisie",
      cell: (l) => (
        peutSaisir ? (
          <div className="flex items-center justify-end gap-2">
            <Input
              className="w-24 text-right"
              inputMode="numeric"
              placeholder={l.quantite_comptee === null ? t("stock.inventaire_detail.ph_qte") : String(l.quantite_comptee)}
              value={saisies[l.id_ligne_inventaire] ?? ""}
              onChange={(e) => setSaisies((s) => ({ ...s, [l.id_ligne_inventaire]: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void enregistrer(l); } }}
            />
            <Button
              size="sm" variant="outline" disabled={enCours === l.id_ligne_inventaire}
              onClick={() => void enregistrer(l)}
            >
              OK
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">{l.motif || "—"}</span>
        )
      ),
    },
  ];

  return (
    <div>
      <Link href="/stock/inventaires" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t("stock.inventaire_detail.lien_inventaires")}
      </Link>
      <PageHeader
        title={inventaire.code_inventaire}
        description={t("stock.inventaire_detail.desc_header", { depot: inventaire.code_depot, date: formatDateTime(inventaire.date_debut), comptees: inventaire.nb_comptees ?? 0, lignes: inventaire.nb_lignes ?? 0 })}
        action={
          <div className="flex flex-wrap gap-2">
            <StatusBadge statut={inventaire.statut} />
            {inventaire.statut === "BROUILLON" && can("inventaire.update") && (
              <Button size="sm" onClick={() => demarrer.mutate({ id: inventaire.id_inventaire })}>
                <Play className="mr-2 h-4 w-4" /> {t("stock.inventaire_detail.act_demarrer")}
              </Button>
            )}
            {enCoursStatut && can("inventaire.valider") && (
              <Button size="sm" onClick={() => setDialogue("valider")}>
                <CheckCircle2 className="mr-2 h-4 w-4" /> {t("stock.inventaire_detail.act_valider")}
              </Button>
            )}
            {(inventaire.statut === "BROUILLON" || enCoursStatut) && can("inventaire.update") && (
              <Button size="sm" variant="outline" className="text-destructive" onClick={() => setDialogue("annuler")}>
                <XCircle className="mr-2 h-4 w-4" /> {t("stock.inventaire_detail.act_annuler")}
              </Button>
            )}
          </div>
        }
      />

      {inventaire.statut === "BROUILLON" && (
        <Card className="mb-4">
          <CardContent className="py-4 text-sm text-muted-foreground">
            {t("stock.inventaire_detail.info_brouillon")}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("stock.inventaire_detail.carte_titre")}</CardTitle>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <SearchInput value={liste.searchInput} onChange={liste.setSearchInput} placeholder={t("stock.inventaire_detail.ph_recherche")} />
            <FilterSelect
              label={t("stock.inventaire_detail.filtre_ecarts")} className="w-48"
              options={[{ value: "true", label: t("stock.inventaire_detail.opt_ecarts") }]}
              value={String(liste.filters.ecart ?? "")}
              onChange={(v) => liste.setFilter("ecart", v)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={colonnes}
            data={liste.query.data}
            isLoading={liste.query.isLoading}
            isFetching={liste.query.isFetching}
            error={liste.query.error}
            rowKey={(l) => l.id_ligne_inventaire}
            page={liste.page} pageSize={liste.pageSize} onPageChange={liste.setPage}
            ordering={liste.ordering} onOrderingChange={liste.setOrdering}
            emptyMessage={inventaire.statut === "BROUILLON" ? "stock.inventaire_detail.vide_brouillon" : "stock.inventaire_detail.vide"}
          />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={dialogue === "valider"}
        onOpenChange={(o) => !o && setDialogue(null)}
        title={t("stock.inventaire_detail.confirm_valider_titre")}
        description={t("stock.inventaire_detail.confirm_valider_desc")}
        confirmLabel={t("stock.inventaire_detail.confirm_valider_btn")}
        loading={valider.isPending}
        onConfirm={() => { valider.mutate({ id: inventaire.id_inventaire }); setDialogue(null); }}
      />
      <ConfirmDialog
        open={dialogue === "annuler"}
        onOpenChange={(o) => !o && setDialogue(null)}
        title={t("stock.inventaire_detail.confirm_annuler_titre")}
        description={t("stock.inventaire_detail.confirm_annuler_desc")}
        confirmLabel={t("stock.inventaire_detail.confirm_annuler_btn")}
        destructive
        loading={annuler.isPending}
        onConfirm={() => { annuler.mutate({ id: inventaire.id_inventaire }); setDialogue(null); }}
      />
    </div>
  );
}
