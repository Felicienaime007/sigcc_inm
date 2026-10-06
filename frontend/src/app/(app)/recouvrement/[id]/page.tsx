"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BellRing, CheckCircle2, Loader2, RefreshCw, Siren, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RequirePrivilege } from "@/components/can";
import { StatusBadge } from "@/components/data/status-badge";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { NiveauSteps } from "@/components/recouvrement/niveau-badge";
import { useAuth } from "@/lib/auth-context";
import { getErrorMessage } from "@/lib/errors";
import { formatAr, formatDate } from "@/lib/format";
import { effetEscalade } from "@/lib/recouvrement";
import { useCrud, useDetail, useRecordAction } from "@/lib/resource";
import type { Dossier } from "@/types/recouvrement";
import { HistoriqueButton } from "@/components/audit/history-button";
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
  const { data: dossier, isLoading, error } = useDetail<Dossier>("recouvrement/dossiers", id);

  const relancer = useRecordAction("recouvrement/dossiers", "relancer", "Relance enregistrée.");
  const escalader = useRecordAction("recouvrement/dossiers", "escalader", "Dossier escaladé.");
  const actualiser = useRecordAction("recouvrement/dossiers", "actualiser", "Soldes actualisés.");
  const crud = useCrud<Dossier>("recouvrement/dossiers");
  const [dialogue, setDialogue] = useState<Dialogue>(null);

  if (isLoading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (error || !dossier) {
    return (
      <div className="space-y-3 py-16 text-center">
        <p className="text-destructive">{getErrorMessage(error, "Dossier introuvable.")}</p>
        <Link href="/recouvrement" className={buttonVariants({ variant: "outline" })}>Retour au recouvrement</Link>
      </div>
    );
  }

  const actif = dossier.statut_dossier !== "REGLE";
  const peutAgir = can("recouvrement.update");
  const supprimable = can("recouvrement.delete") && dossier.niveau_relance === 1 && dossier.statut_dossier === "EN_COURS";

  async function agir(type: "relancer" | "escalader" | "actualiser") {
    try {
      await { relancer, escalader, actualiser }[type].mutateAsync({ id: dossier!.id_recouvrement });
    } catch {
      // Le serveur a pu constater que le dossier est soldé : on recharge l'état réel
      void qc.invalidateQueries();
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
          <ArrowLeft className="h-4 w-4" /> Recouvrement
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">{dossier.num_dossier}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <StatusBadge statut={dossier.statut_dossier} />
              <span>Dernière relance le {formatDate(dossier.date_relance)}</span>
            </div>
          </div>
          <HistoriqueButton table="recouvrement" objet={dossier.id_recouvrement} titre={dossier.num_dossier} />
          {peutAgir && (
            <div className="flex flex-wrap gap-2">
              {actif && (
                <Button onClick={() => setDialogue("relancer")}>
                  <BellRing className="mr-2 h-4 w-4" /> Relancer
                </Button>
              )}
              {actif && dossier.niveau_relance < 3 && (
                <Button variant="outline" onClick={() => setDialogue("escalader")}>
                  <Siren className="mr-2 h-4 w-4" /> Escalader
                </Button>
              )}
              <Button variant="outline" disabled={actualiser.isPending} onClick={() => agir("actualiser")}>
                <RefreshCw className={`mr-2 h-4 w-4 ${actualiser.isPending ? "animate-spin" : ""}`} /> Actualiser
              </Button>
              {supprimable && (
                <Button variant="outline" onClick={() => setDialogue("supprimer")}>
                  <Trash2 className="mr-2 h-4 w-4 text-destructive" /> Supprimer
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {dossier.statut_dossier === "REGLE" && (
        <p className="flex items-center gap-2 rounded-md bg-green-50 p-3 text-sm text-green-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> Toutes les factures de ce dossier sont soldées : il est réglé.
        </p>
      )}
      {dossier.statut_dossier === "CONTENTIEUX" && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          Dossier en contentieux. Le client n'est pas bloqué automatiquement
          {dossier.client && can("client.view") && (
            <> — vous pouvez le faire depuis <Link href={`/clients/${dossier.client}`} className="underline">sa fiche</Link> (solvabilité).</>
          )}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Client</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {dossier.client && can("client.view") ? (
              <Link href={`/clients/${dossier.client}`} className="text-base font-medium hover:underline">{dossier.nom_client}</Link>
            ) : (
              <p className="text-base font-medium">{dossier.nom_client ?? "—"}</p>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Reste à recouvrer</p>
              <p className="text-2xl font-semibold tabular-nums">{formatAr(dossier.total_a_recouvrer)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Progression</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <NiveauSteps niveau={dossier.niveau_relance} />
            <p className="text-xs text-muted-foreground">
              Chaque relance met à jour la date de dernière relance. Le niveau 3 met le dossier en contentieux.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Factures du dossier</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Facture</TableHead>
                  <TableHead>Émise le</TableHead>
                  <TableHead>Échéance</TableHead>
                  <TableHead className="text-right">Retard</TableHead>
                  <TableHead className="text-right">Reste à recouvrer</TableHead>
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
                      {Number(l.montant_a_recouvrer) === 0 ? <span className="text-green-700">Soldée</span>
                        : <span className={l.jours_retard > 0 ? "text-red-600" : ""}>{l.jours_retard} j</span>}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatAr(l.montant_a_recouvrer)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={4} className="text-right font-medium">Total</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatAr(dossier.total_a_recouvrer)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={dialogue === "relancer"}
        onOpenChange={(o) => !o && setDialogue(null)}
        title="Enregistrer une relance ?"
        description="La date de dernière relance passe à aujourd'hui. Le niveau du dossier ne change pas."
        confirmLabel="Relancer"
        loading={relancer.isPending}
        onConfirm={() => agir("relancer")}
      />
      <ConfirmDialog
        open={dialogue === "escalader"}
        onOpenChange={(o) => !o && setDialogue(null)}
        title="Passer au niveau suivant ?"
        description={`${effetEscalade(dossier.niveau_relance)} La date de dernière relance passe à aujourd'hui. Cette action ne s'annule pas.`}
        confirmLabel="Escalader"
        destructive={dossier.niveau_relance === 2}
        loading={escalader.isPending}
        onConfirm={() => agir("escalader")}
      />
      <ConfirmDialog
        open={dialogue === "supprimer"}
        onOpenChange={(o) => !o && setDialogue(null)}
        title="Supprimer le dossier ?"
        description="Seul un dossier encore au niveau 1 peut être supprimé (erreur d'ouverture). Les factures redeviennent disponibles dans la liste des impayés."
        confirmLabel="Supprimer"
        destructive
        loading={crud.remove.isPending}
        onConfirm={supprimer}
      />
    </div>
  );
}