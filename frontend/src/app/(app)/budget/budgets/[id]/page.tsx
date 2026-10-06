"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, CalendarRange, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RequirePrivilege } from "@/components/can";
import { BudgetDialog } from "@/components/budget/budget-dialog";
import { LigneDialog } from "@/components/budget/ligne-dialog";
import { PrevisionsDialog } from "@/components/budget/previsions-dialog";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { useAuth } from "@/lib/auth-context";
import { getErrorMessage } from "@/lib/errors";
import { formatAr } from "@/lib/format";
import { useCrud, useDetail, useOptions } from "@/lib/resource";
import { dotation, type Budget, type LigneBudget } from "@/types/budget";

export default function BudgetDetailPage() {
  return (
    <RequirePrivilege privilege="budget.view">
      <Contenu />
    </RequirePrivilege>
  );
}

function Chiffre({ label, valeur, ton }: { label: string; valeur: number; ton?: string }) {
  return (
    <Card>
      <CardContent className="space-y-1 pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`text-xl font-semibold tabular-nums ${ton ?? ""}`}>{formatAr(valeur)}</p>
      </CardContent>
    </Card>
  );
}

type Dialogue =
  | { type: "budget" }
  | { type: "ligne"; ligne: LigneBudget | null }
  | { type: "previsions"; ligne: LigneBudget }
  | null;

function Contenu() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const { data: budget, isLoading, error } = useDetail<Budget>("budget/budgets", id);
  const lignes = useOptions<LigneBudget>("budget/lignes", { budget: id }, can("ligne_budgetaire.view"));
  const crud = useCrud<LigneBudget>("budget/lignes");

  const [dialogue, setDialogue] = useState<Dialogue>(null);
  const [aSupprimer, setASupprimer] = useState<LigneBudget | null>(null);

  if (isLoading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (error || !budget) {
    return (
      <div className="space-y-3 py-16 text-center">
        <p className="text-destructive">{getErrorMessage(error, "Budget introuvable.")}</p>
        <Link href="/budget/budgets" className={buttonVariants({ variant: "outline" })}>Retour à la liste</Link>
      </div>
    );
  }

  const liste = lignes.data ?? [];
  const alloue = Number(budget.montant_alloue);
  const reparti = liste.reduce((s, l) => s + dotation(l), 0);
  const engage = liste.reduce((s, l) => s + Number(l.total_engage), 0);
  const disponible = liste.reduce((s, l) => s + Number(l.montant_disponible), 0);
  const depassement = Math.round(reparti * 100) > Math.round(alloue * 100);

  async function supprimer() {
    if (!aSupprimer) return;
    try {
      await crud.remove.mutateAsync(aSupprimer.id_ligne_budget);
    } catch {
      /* 409 : prévisions ou engagements rattachés */
    }
    setASupprimer(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/budget/budgets" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Budgets
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Budget {budget.annee_budgetaire}</h1>
            <p className="text-sm text-muted-foreground">{budget.nom_organisme}</p>
          </div>
          {can("budget.update") && (
            <Button variant="outline" onClick={() => setDialogue({ type: "budget" })}>
              <Pencil className="mr-2 h-4 w-4" /> Modifier
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Chiffre label="Montant alloué" valeur={alloue} />
        <Chiffre label="Réparti sur les lignes" valeur={reparti} ton={depassement ? "text-red-600" : ""} />
        <Chiffre label="Engagé" valeur={engage} ton="text-amber-600" />
        <Chiffre label="Disponible" valeur={disponible} ton="text-green-600" />
      </div>

      {depassement && (
        <p className="flex items-center gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Les dotations des lignes ({formatAr(reparti)}) dépassent le montant alloué du budget ({formatAr(alloue)}).
        </p>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Lignes budgétaires</CardTitle>
          {can("ligne_budgetaire.create") && (
            <Button size="sm" onClick={() => setDialogue({ type: "ligne", ligne: null })}>
              <Plus className="mr-2 h-4 w-4" /> Nouvelle ligne
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {!can("ligne_budgetaire.view") ? (
            <p className="text-sm text-muted-foreground">Vous n'avez pas accès au détail des lignes.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Article</TableHead>
                    <TableHead>Financement</TableHead>
                    <TableHead className="text-right">Dotation</TableHead>
                    <TableHead className="text-right">Engagé</TableHead>
                    <TableHead className="text-right">Disponible</TableHead>
                    <TableHead className="w-px" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lignes.isLoading && (
                    <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Chargement…</TableCell></TableRow>
                  )}
                  {!lignes.isLoading && liste.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Aucune ligne budgétaire.</TableCell></TableRow>
                  )}
                  {liste.map((l) => (
                    <TableRow key={l.id_ligne_budget}>
                      <TableCell>
                        <p className="font-medium">{l.code_article}</p>
                        <p className="text-xs text-muted-foreground">{l.libelle_ligne}</p>
                      </TableCell>
                      <TableCell className="text-sm">{l.libelle_financement ?? <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatAr(dotation(l))}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatAr(l.total_engage)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{formatAr(l.montant_disponible)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {can("prevision.view") && (
                            <Button variant="ghost" size="icon" title="Prévisions" onClick={() => setDialogue({ type: "previsions", ligne: l })}>
                              <CalendarRange className="h-4 w-4" />
                            </Button>
                          )}
                          {can("ligne_budgetaire.update") && (
                            <Button variant="ghost" size="icon" title="Modifier" onClick={() => setDialogue({ type: "ligne", ligne: l })}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {can("ligne_budgetaire.delete") && (
                            <Button variant="ghost" size="icon" title="Supprimer" onClick={() => setASupprimer(l)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {dialogue?.type === "budget" && <BudgetDialog budget={budget} onClose={() => setDialogue(null)} />}
      {dialogue?.type === "ligne" && <LigneDialog budget={budget} ligne={dialogue.ligne} onClose={() => setDialogue(null)} />}
      {dialogue?.type === "previsions" && <PrevisionsDialog ligne={dialogue.ligne} onClose={() => setDialogue(null)} />}

      <ConfirmDialog
        open={aSupprimer !== null}
        onOpenChange={(o) => !o && setASupprimer(null)}
        title="Supprimer la ligne budgétaire ?"
        description={`L'article « ${aSupprimer?.code_article ?? ""} » sera supprimé. Impossible s'il a des prévisions ou des engagements.`}
        confirmLabel="Supprimer"
        destructive
        loading={crud.remove.isPending}
        onConfirm={supprimer}
      />
    </div>
  );
}