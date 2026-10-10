"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BellRing, CheckCircle2, Loader2, RefreshCw, Siren, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { RequirePrivilege } from "@/components/can";
import { StatusBadge } from "@/components/data/status-badge";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { Field } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { NiveauSteps } from "@/components/recouvrement/niveau-badge";
import { useAuth } from "@/lib/auth-context";
import { getErrorMessage } from "@/lib/errors";
import { formatAr, formatDate, formatDateTime } from "@/lib/format";
import { useT } from "@/lib/i18n/contexte";
import { useCrud, useDetail, useRecordAction } from "@/lib/resource";
import { FilterSelect } from "@/components/data/filter-select";
import { CANAUX_RELANCE, libelleCanal, libelleNatureRelance, type Dossier } from "@/types/recouvrement";
import { HistoriqueButton } from "@/components/audit/history-button";
import { ImprimerButton } from "@/components/editions/imprimer-button";
export default function DossierDetailPage() {
  return (
    <RequirePrivilege privilege="recouvrement.view">
      <Contenu />
    </RequirePrivilege>
  );
}

type Dialogue = "relancer" | "escalader" | "supprimer" | null;

function Contenu() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { can } = useAuth();
  const { t } = useT();
  const { data: dossier, isLoading, error } = useDetail<Dossier>("recouvrement/dossiers", id);

  const relancer = useRecordAction("recouvrement/dossiers", "relancer", t("recouvrement.detail.relance_toast"));
  const escalader = useRecordAction("recouvrement/dossiers", "escalader", t("recouvrement.detail.escalade_toast"));
  const actualiser = useRecordAction("recouvrement/dossiers", "actualiser", t("recouvrement.detail.actualiser_toast"));
  const crud = useCrud<Dossier>("recouvrement/dossiers");
  const [dialogue, setDialogue] = useState<Dialogue>(null);
  const [canal, setCanal] = useState("TELEPHONE");
  const [commentaire, setCommentaire] = useState("");
  const [erreurAction, setErreurAction] = useState<string | null>(null);

  function ouvrir(type: "relancer" | "escalader") {
    setCanal("TELEPHONE");
    setCommentaire("");
    setErreurAction(null);
    setDialogue(type);
  }

  if (isLoading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (error || !dossier) {
    return (
      <div className="space-y-3 py-16 text-center">
        <p className="text-destructive">{getErrorMessage(error, t("recouvrement.detail.introuvable"))}</p>
        <Link href="/recouvrement" className={buttonVariants({ variant: "outline" })}>{t("recouvrement.detail.retour")}</Link>
      </div>
    );
  }

  const actif = dossier.statut_dossier !== "REGLE";
  const peutAgir = can("recouvrement.update");
  const supprimable = can("recouvrement.delete") && dossier.niveau_relance === 1 && dossier.statut_dossier === "EN_COURS";

  async function agir(type: "relancer" | "escalader" | "actualiser") {
    try {
      const body = type === "actualiser" ? undefined : { canal, commentaire: commentaire.trim() };
      await { relancer, escalader, actualiser }[type].mutateAsync({ id: dossier!.id_recouvrement, body });
    } catch (e) {
      // Le serveur a pu constater que le dossier est soldé : on recharge l'état réel
      setErreurAction(getErrorMessage(e));
      void qc.invalidateQueries();
      return;
    }
    setDialogue(null);
  }

  async function supprimer() {
    try {
      await crud.remove.mutateAsync(dossier!.id_recouvrement);
      router.replace("/recouvrement");
    } catch {
      setDialogue(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/recouvrement" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {t("recouvrement.detail.fil")}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">{dossier.num_dossier}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <StatusBadge statut={dossier.statut_dossier} />
              <span>{t("recouvrement.detail.derniere_relance", { date: formatDate(dossier.date_relance) })}</span>
            </div>
          </div>
          <HistoriqueButton table="recouvrement" objet={dossier.id_recouvrement} titre={dossier.num_dossier} />
          <div className="flex flex-wrap gap-2">
            {actif && (
              <ImprimerButton
                chemin={`relance/${dossier.id_recouvrement}`}
                libelle={
                  dossier.niveau_relance === 3
                    ? t("recouvrement.detail.imprimer_mise_en_demeure")
                    : dossier.niveau_relance === 2
                      ? t("recouvrement.detail.imprimer_deuxieme")
                      : t("recouvrement.detail.imprimer_lettre")
                }
              />
            )}
            {peutAgir && (
              <>
                {actif && (
                  <Button onClick={() => ouvrir("relancer")}>
                    <BellRing className="mr-2 h-4 w-4" /> {t("recouvrement.detail.relancer")}
                  </Button>
                )}
                {actif && dossier.niveau_relance < 3 && (
                  <Button variant="outline" onClick={() => ouvrir("escalader")}>
                    <Siren className="mr-2 h-4 w-4" /> {t("recouvrement.detail.escalader")}
                  </Button>
                )}
                <Button variant="outline" disabled={actualiser.isPending} onClick={() => agir("actualiser")}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${actualiser.isPending ? "animate-spin" : ""}`} /> {t("recouvrement.detail.actualiser")}
                </Button>
                {supprimable && (
                  <Button variant="outline" onClick={() => setDialogue("supprimer")}>
                    <Trash2 className="mr-2 h-4 w-4 text-destructive" /> {t("recouvrement.detail.supprimer")}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {dossier.statut_dossier === "REGLE" && (
        <p className="flex items-center gap-2 rounded-md bg-green-50 dark:bg-green-950/70 p-3 text-sm text-green-800 dark:text-green-200">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {t("recouvrement.detail.bandeau_regle")}
        </p>
      )}
      {dossier.statut_dossier === "CONTENTIEUX" && (
        <p className="rounded-md bg-red-50 dark:bg-red-950/70 p-3 text-sm text-red-800 dark:text-red-200">
          {t("recouvrement.detail.bandeau_contentieux")}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">{t("recouvrement.detail.client")}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {dossier.client && can("client.view") ? (
              <Link href={`/clients/${dossier.client}`} className="text-base font-medium hover:underline">{dossier.nom_client}</Link>
            ) : (
              <p className="text-base font-medium">{dossier.nom_client ?? "—"}</p>
            )}
            <div>
              <p className="text-xs text-muted-foreground">{t("recouvrement.detail.reste")}</p>
              <p className="text-2xl font-semibold tabular-nums">{formatAr(dossier.total_a_recouvrer)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{t("recouvrement.detail.progression")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <NiveauSteps niveau={dossier.niveau_relance} />
            <p className="text-xs text-muted-foreground">
              {t("recouvrement.detail.progression_hint")}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("recouvrement.detail.factures_titre")}</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("recouvrement.detail.col_facture")}</TableHead>
                  <TableHead>{t("recouvrement.detail.col_emise")}</TableHead>
                  <TableHead>{t("recouvrement.detail.col_echeance")}</TableHead>
                  <TableHead className="text-right">{t("recouvrement.detail.col_retard")}</TableHead>
                  <TableHead className="text-right">{t("recouvrement.detail.col_reste")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dossier.lignes.map((l) => (
                  <TableRow key={l.facture}>
                    <TableCell>
                      {can("facture.view")
                        ? <Link href={`/commercial/factures/${l.facture}`} className="font-medium hover:underline">{l.num_facture}</Link>
                        : <span className="font-medium">{l.num_facture}</span>}
                    </TableCell>
                    <TableCell>{formatDate(l.date_facture)}</TableCell>
                    <TableCell>{formatDate(l.echeance)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(l.montant_a_recouvrer) === 0 ? <span className="text-green-700">{t("recouvrement.detail.soldee")}</span>
                        : <span className={l.jours_retard > 0 ? "text-red-600" : ""}>{t("recouvrement.impayes.jours", { n: l.jours_retard })}</span>}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatAr(l.montant_a_recouvrer)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={4} className="text-right font-medium">{t("recouvrement.detail.total")}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatAr(dossier.total_a_recouvrer)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("recouvrement.detail.relances_titre")}</CardTitle></CardHeader>
        <CardContent>
          {(dossier.relances ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("recouvrement.detail.aucune_relance")}</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("recouvrement.detail.col_date")}</TableHead>
                    <TableHead>{t("recouvrement.detail.col_niveau")}</TableHead>
                    <TableHead>{t("recouvrement.detail.col_nature")}</TableHead>
                    <TableHead>{t("recouvrement.detail.col_canal")}</TableHead>
                    <TableHead>{t("recouvrement.detail.col_par")}</TableHead>
                    <TableHead>{t("recouvrement.detail.col_commentaire")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dossier.relances.map((r) => (
                    <TableRow key={r.id_relance}>
                      <TableCell className="whitespace-nowrap">{formatDateTime(r.date_relance)}</TableCell>
                      <TableCell className="tabular-nums">{r.niveau}</TableCell>
                      <TableCell>{t(libelleNatureRelance(r.nature))}</TableCell>
                      <TableCell>{t(libelleCanal(r.canal))}</TableCell>
                      <TableCell>{r.auteur_nom ?? "—"}</TableCell>
                      <TableCell className="max-w-xs whitespace-pre-wrap">{r.commentaire || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <FormDialog
        open={dialogue === "relancer"}
        onOpenChange={(o) => !o && setDialogue(null)}
        title={t("recouvrement.detail.relancer_titre")}
        description={t("recouvrement.detail.relancer_desc")}
        onSubmit={(e) => { e?.preventDefault(); void agir("relancer"); }}
        submitting={relancer.isPending}
        error={erreurAction}
        submitLabel={t("recouvrement.detail.relancer")}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("recouvrement.detail.canal")}>
            <FilterSelect
              label={t("recouvrement.detail.canal")} options={CANAUX_RELANCE.map((o) => ({ value: o.value, label: t(o.label) }))}
              value={canal} onChange={setCanal}
            />
          </Field>
        </div>
        <Field label={t("recouvrement.detail.commentaire")} htmlFor="commentaire_relance" hint={t("recouvrement.detail.commentaire_hint")}>
          <Textarea
            id="commentaire_relance" rows={3} autoFocus
            value={commentaire} onChange={(e) => setCommentaire(e.target.value)}
            placeholder={t("recouvrement.detail.commentaire_relance_ph")}
          />
        </Field>
      </FormDialog>
      <FormDialog
        open={dialogue === "escalader"}
        onOpenChange={(o) => !o && setDialogue(null)}
        title={t("recouvrement.detail.escalader_titre")}
        description={t(dossier.niveau_relance === 1 ? "recouvrement.detail.escalader_desc_2" : "recouvrement.detail.escalader_desc_3")}
        onSubmit={(e) => { e?.preventDefault(); void agir("escalader"); }}
        submitting={escalader.isPending}
        error={erreurAction}
        submitLabel={t("recouvrement.detail.escalader")}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("recouvrement.detail.canal")}>
            <FilterSelect
              label={t("recouvrement.detail.canal")} options={CANAUX_RELANCE.map((o) => ({ value: o.value, label: t(o.label) }))}
              value={canal} onChange={setCanal}
            />
          </Field>
        </div>
        <Field label={t("recouvrement.detail.commentaire")} htmlFor="commentaire_escalade">
          <Textarea
            id="commentaire_escalade" rows={3} autoFocus
            value={commentaire} onChange={(e) => setCommentaire(e.target.value)}
            placeholder={t("recouvrement.detail.commentaire_escalade_ph")}
          />
        </Field>
      </FormDialog>
      <ConfirmDialog
        open={dialogue === "supprimer"}
        onOpenChange={(o) => !o && setDialogue(null)}
        title={t("recouvrement.detail.suppr_titre")}
        description={t("recouvrement.detail.suppr_desc")}
        confirmLabel={t("recouvrement.detail.supprimer_btn")}
        destructive
        loading={crud.remove.isPending}
        onConfirm={supprimer}
      />
    </div>
  );
}