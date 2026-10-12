"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DangerConfirm } from "@/components/forms/danger-confirm";
import { AmountInput } from "@/components/forms/amount-input";
import { RowActions } from "@/components/data/row-actions";
import { Field } from "@/components/forms/field";
import { useAuth } from "@/lib/auth-context";
import { versNombre } from "@/lib/clients";
import { getErrorMessage } from "@/lib/errors";
import { formatAr } from "@/lib/format";
import { useT } from "@/lib/i18n/contexte";
import { useCrud, useOptions } from "@/lib/resource";
import type { LigneBudget, Prevision } from "@/types/budget";

/** Prévisions budgétaires d'une ligne, par période (ex. 2026-T1). */
export function PrevisionsDialog({ ligne, onClose }: { ligne: LigneBudget; onClose: () => void }) {
  const { can } = useAuth();
  const { data, isLoading } = useOptions<Prevision>("budget/previsions", { ligne_budget: ligne.id_ligne_budget });
  const crud = useCrud<Prevision, Record<string, unknown>>("budget/previsions");

  const [edition, setEdition] = useState<Prevision | null>(null);
  const [periode, setPeriode] = useState("");
  const [montant, setMontant] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [aSupprimer, setASupprimer] = useState<Prevision | null>(null);
  const { t } = useT();

  const peutEcrire = can("prevision.create") || can("prevision.update");
  const total = (data ?? []).reduce((s, p) => s + Number(p.montant_estime), 0);

  function reinitialiser() {
    setEdition(null);
    setPeriode("");
    setMontant("");
    setErreur(null);
  }

  async function enregistrer() {
    setErreur(null);
    if (!periode.trim()) return setErreur(t("budget.pdlg.err_periode"));
    const m = versNombre(montant);
    if (montant.trim() === "" || !Number.isFinite(m) || m < 0) return setErreur(t("budget.pdlg.err_montant"));
    const body = { periode: periode.trim(), montant_estime: Math.round(m * 100) / 100 };
    try {
      if (edition) await crud.update.mutateAsync({ id: edition.id_prevision, body });
      else await crud.create.mutateAsync({ ...body, ligne_budget: ligne.id_ligne_budget });
      reinitialiser();
    } catch (e) {
      setErreur(getErrorMessage(e));
    }
  }

  async function supprimer() {
    if (!aSupprimer) return;
    try {
      await crud.remove.mutateAsync(aSupprimer.id_prevision);
    } catch {
      /* message du serveur déjà affiché en notification */
    }
    setASupprimer(null);
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("budget.pdlg.titre", { code: ligne.code_article })}</DialogTitle>
          <DialogDescription>
            {t("budget.pdlg.description", { libelle: ligne.libelle_ligne, annee: ligne.annee_budgetaire })}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("budget.pdlg.col_periode")}</TableHead>
                <TableHead className="text-right">{t("budget.pdlg.col_montant")}</TableHead>
                <TableHead className="w-px" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={3} className="py-6 text-center text-muted-foreground">{t("budget.pdlg.chargement")}</TableCell></TableRow>
              )}
              {!isLoading && data?.length === 0 && (
                <TableRow><TableCell colSpan={3} className="py-6 text-center text-muted-foreground">{t("budget.pdlg.aucune")}</TableCell></TableRow>
              )}
              {data?.map((p) => (
                <TableRow key={p.id_prevision}>
                  <TableCell className="font-medium">{p.periode}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatAr(p.montant_estime)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <RowActions
                        items={[
                          ...(can("prevision.update")
                            ? [{
                                key: "modifier", label: t("budget.pdlg.modifier"), icon: Pencil,
                                onSelect: () => {
                                  setEdition(p); setPeriode(p.periode); setMontant(String(Number(p.montant_estime))); setErreur(null);
                                },
                              }]
                            : []),
                          ...(can("prevision.delete")
                            ? [{ key: "supprimer", label: t("budget.pdlg.supprimer"), icon: Trash2, danger: true, onSelect: () => setASupprimer(p) }]
                            : []),
                        ]}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(data?.length ?? 0) > 0 && (
                <TableRow>
                  <TableCell className="text-right font-medium">{t("budget.pdlg.total")}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatAr(total)}</TableCell>
                  <TableCell />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {peutEcrire && (
          <form
            onSubmit={(e) => { e.preventDefault(); void enregistrer(); }}
            className="space-y-3 rounded-md border bg-muted/30 p-3"
            noValidate
          >
            <p className="text-sm font-medium">{edition ? t("budget.pdlg.modif_periode", { periode: edition.periode }) : t("budget.pdlg.ajouter")}</p>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <Field label={t("budget.pdlg.periode")} htmlFor="periode">
                <Input id="periode" placeholder={t("budget.pdlg.periode_ph")} value={periode} onChange={(e) => setPeriode(e.target.value)} maxLength={50} />
              </Field>
              <Field label={t("budget.pdlg.montant")} htmlFor="montant_estime">
                <AmountInput
                  id="montant_estime"
                  value={montant.trim() === "" ? null : versNombre(montant)}
                  onChange={(v) => setMontant(v === null ? "" : String(v))}
                />
              </Field>
              <div className="flex items-end gap-2">
                <Button type="submit" disabled={crud.create.isPending || crud.update.isPending}>
                  {edition ? t("budget.pdlg.enregistrer") : <><Plus className="mr-2 h-4 w-4" /> {t("budget.pdlg.ajouter_btn")}</>}
                </Button>
                {edition && <Button type="button" variant="outline" onClick={reinitialiser}>{t("budget.pdlg.annuler")}</Button>}
              </div>
            </div>
            {erreur && <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{erreur}</p>}
          </form>
        )}

        <DangerConfirm
          open={aSupprimer !== null}
          onOpenChange={(o) => !o && setASupprimer(null)}
          title={t("budget.pdlg.suppr_titre")}
          description={t("budget.pdlg.suppr_desc", { periode: aSupprimer?.periode ?? "" })}
          confirmLabel={t("budget.pdlg.supprimer_btn")}
          loading={crud.remove.isPending}
          onConfirm={supprimer}
        />
      </DialogContent>
    </Dialog>
  );
}