"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Ban, CheckCircle2, Loader2, Pencil, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RequirePrivilege } from "@/components/can";
import { CommandeDialog } from "@/components/commercial/commande-dialog";
import { TypeBadge } from "@/components/clients/type-badge";
import { StatusBadge } from "@/components/data/status-badge";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { useAuth } from "@/lib/auth-context";
import { estSoa } from "@/lib/clients";
import { getErrorMessage } from "@/lib/errors";
import { formatAr, formatDate, formatNombre } from "@/lib/format";
import { useCrud, useDetail, useList, useRecordAction } from "@/lib/resource";
import type { Commande, Facture, Preparation } from "@/types/commercial";
import { HistoriqueButton } from "@/components/audit/history-button";

export default function CommandeDetailPage() {
  return (
    <RequirePrivilege privilege="commande.view">
      <Contenu />
    </RequirePrivilege>
  );
}

type Dialogue = "modifier" | "valider" | "annuler" | "supprimer" | null;

function Contenu() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useAuth();
  const { data: commande, isLoading, error } = useDetail<Commande>("commercial/commandes", id);

  // Documents liés : lus seulement si le rôle a le droit de les voir
  const preparations = useList<Preparation>("commercial/preparations", { commande: id, page_size: 1 }, can("preparation.view"));
  const factures = useList<Facture>("commercial/factures", { commande: id, page_size: 1 }, can("facture.view"));

  const valider = useRecordAction("commercial/commandes", "valider", "Commande validée.");
  const annuler = useRecordAction("commercial/commandes", "annuler", "Commande annulée.");
  const crud = useCrud<Commande>("commercial/commandes");
  const [dialogue, setDialogue] = useState<Dialogue>(null);

  if (isLoading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (error || !commande) {
    return (
      <div className="space-y-3 py-16 text-center">
        <p className="text-destructive">{getErrorMessage(error, "Commande introuvable.")}</p>
        <Link href="/commercial/commandes" className={buttonVariants({ variant: "outline" })}>Retour à la liste</Link>
      </div>
    );
  }

  const soa = estSoa(commande.type_client);
  const brouillon = commande.statut_commande === "BROUILLON";
  const annulable = brouillon || commande.statut_commande === "VALIDEE";
  const preparation = preparations.data?.results[0];
  const facture = factures.data?.results[0];

  async function agir(action: "valider" | "annuler") {
    try {
      await (action === "valider" ? valider : annuler).mutateAsync({ id: commande!.id_commande });
    } catch {
      /* le message du serveur (client bloqué, plafond, crédit insuffisant…) est affiché en notification */
    }
    setDialogue(null);
  }

  async function supprimer() {
    try {
      await crud.remove.mutateAsync(commande!.id_commande);
      router.replace("/commercial/commandes");
    } catch {
      setDialogue(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/commercial/commandes" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Commandes
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">{commande.num_commande}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <StatusBadge statut={commande.statut_commande} />
              <span>{formatDate(commande.date_commande)}</span>
            </div>
          </div>
          <HistoriqueButton table="commande" objet={commande.id_commande} titre={commande.num_commande} />
          <div className="flex flex-wrap gap-2">
            {brouillon && can("commande.valider") && (
              <Button onClick={() => setDialogue("valider")}>
                <CheckCircle2 className="mr-2 h-4 w-4" /> Valider
              </Button>
            )}
            {brouillon && can("commande.update") && (
              <Button variant="outline" onClick={() => setDialogue("modifier")}>
                <Pencil className="mr-2 h-4 w-4" /> Modifier
              </Button>
            )}
            {annulable && can("commande.update") && (
              <Button variant="outline" onClick={() => setDialogue("annuler")}>
                <Ban className="mr-2 h-4 w-4" /> Annuler
              </Button>
            )}
            {brouillon && can("commande.delete") && (
              <Button variant="outline" onClick={() => setDialogue("supprimer")}>
                <Trash2 className="mr-2 h-4 w-4 text-destructive" /> Supprimer
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Client</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Link href={`/clients/${commande.client}`} className="font-medium hover:underline">{commande.nom_client}</Link>
              <TypeBadge type={commande.type_client} />
            </div>
            {commande.num_devis && (
              <div><p className="text-xs text-muted-foreground">Devis source</p><p className="font-medium">{commande.num_devis}</p></div>
            )}
            {soa && (
              <div>
                <p className="text-xs text-muted-foreground">Engagement budgétaire</p>
                {commande.num_engagement_cf ? (
                  <p className="font-medium">{commande.num_engagement_cf}</p>
                ) : (
                  <p className="text-amber-700">
                    Aucun engagement rattaché{brouillon ? " : obligatoire pour valider (bouton « Modifier »)." : "."}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Suite du cycle</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {commande.statut_commande === "VALIDEE" && (
              <p>
                Validée : le magasinier peut créer la préparation.
                {can("preparation.create") && (
                  <> <Link href="/commercial/preparations" className="underline">Aller aux préparations</Link></>
                )}
              </p>
            )}
            {preparation && <p>Préparation : <StatusBadge statut={preparation.statut_prepa} /></p>}
            {facture && (
              <p>
                Facture : <Link href={`/commercial/factures/${facture.id_facture}`} className="font-medium hover:underline">{facture.num_facture}</Link>{" "}
                <StatusBadge statut={facture.statut_paiement} />
              </p>
            )}
            {commande.statut_commande === "LIVREE" && !facture && <p>Livrée : en attente de facturation.</p>}
            {brouillon && <p className="text-muted-foreground">Brouillon : modifiable tant qu'elle n'est pas validée.</p>}
            {commande.statut_commande === "ANNULEE" && <p className="text-muted-foreground">Commande annulée.</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Lignes</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produit</TableHead>
                  <TableHead className="text-right">Quantité</TableHead>
                  <TableHead className="text-right">Prix unitaire</TableHead>
                  <TableHead className="text-right">Montant HT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commande.lignes.map((l) => (
                  <TableRow key={l.produit}>
                    <TableCell>
                      <p className="font-medium">{l.designation}</p>
                      <p className="text-xs text-muted-foreground">{l.code_produit}</p>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNombre(l.quantite_commandee)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatAr(l.prix_unitaire_facture)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatAr(l.quantite_commandee * Number(l.prix_unitaire_facture))}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={3} className="text-right font-medium">Total HT</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatAr(commande.total)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {dialogue === "modifier" && <CommandeDialog commande={commande} onClose={() => setDialogue(null)} />}

      <ConfirmDialog
        open={dialogue === "valider"}
        onOpenChange={(o) => !o && setDialogue(null)}
        title="Valider la commande ?"
        description={
          soa
            ? `Le total (${formatAr(commande.total)}) est contrôlé par rapport à l'engagement, qui sera consommé (soldé). La commande ne sera plus modifiable.`
            : commande.type_client === "PRIVE"
              ? `Le client doit avoir une fiche de solvabilité non bloquée, et le total plus son encours ne doit pas dépasser son plafond. La commande ne sera plus modifiable.`
              : "La commande ne sera plus modifiable."
        }
        confirmLabel="Valider"
        loading={valider.isPending}
        onConfirm={() => agir("valider")}
      />
      <ConfirmDialog
        open={dialogue === "annuler"}
        onOpenChange={(o) => !o && setDialogue(null)}
        title="Annuler la commande ?"
        description={
          soa && commande.statut_commande === "VALIDEE"
            ? "L'engagement consommé redevient disponible et est détaché de cette commande."
            : "La commande sera annulée. Cette action est définitive."
        }
        confirmLabel="Annuler la commande"
        destructive
        loading={annuler.isPending}
        onConfirm={() => agir("annuler")}
      />
      <ConfirmDialog
        open={dialogue === "supprimer"}
        onOpenChange={(o) => !o && setDialogue(null)}
        title="Supprimer la commande ?"
        description="Seule une commande en brouillon peut être supprimée. Elle disparaît définitivement."
        confirmLabel="Supprimer"
        destructive
        loading={crud.remove.isPending}
        onConfirm={supprimer}
      />
    </div>
  );
}