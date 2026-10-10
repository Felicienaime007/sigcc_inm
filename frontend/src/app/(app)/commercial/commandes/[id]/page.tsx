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
import { useT } from "@/lib/i18n/contexte";
import type { Commande, Facture, Preparation } from "@/types/commercial";
import { HistoriqueButton } from "@/components/audit/history-button";
import { ImprimerButton } from "@/components/editions/imprimer-button";

export default function CommandeDetailPage() {
  return (
    <RequirePrivilege privilege="commande.view">
      <Contenu />
    </RequirePrivilege>
  );
}

type Dialogue = "modifier" | "valider" | "annuler" | "supprimer" | null;

function Contenu() {
  const { t } = useT();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useAuth();
  const { data: commande, isLoading, error } = useDetail<Commande>("commercial/commandes", id);

  // Documents liés : lus seulement si le rôle a le droit de les voir (et une fois l'id connu)
  const preparations = useList<Preparation>("commercial/preparations", { commande: id, page_size: 1 }, can("preparation.view") && !!id);
  const factures = useList<Facture>("commercial/factures", { commande: id, page_size: 1 }, can("facture.view") && !!id);

  const valider = useRecordAction("commercial/commandes", "valider", t("commercial.commande_detail.succes_validee"));
  const annuler = useRecordAction("commercial/commandes", "annuler", t("commercial.commande_detail.succes_annulee"));
  const crud = useCrud<Commande>("commercial/commandes");
  const [dialogue, setDialogue] = useState<Dialogue>(null);

  if (isLoading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (error || !commande) {
    return (
      <div className="space-y-3 py-16 text-center">
        <p className="text-destructive">{getErrorMessage(error, t("commercial.commande_detail.err_introuvable"))}</p>
        <Link href="/commercial/commandes" className={buttonVariants({ variant: "outline" })}>{t("commercial.commande_detail.retour_liste")}</Link>
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
          <ArrowLeft className="h-4 w-4" /> {t("commercial.commande_detail.fil_commandes")}
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
            <ImprimerButton chemin={`commande/${commande.id_commande}`} libelle={t("commercial.commande_detail.imprimer")} />
            {brouillon && can("commande.valider") && (
              <Button onClick={() => setDialogue("valider")}>
                <CheckCircle2 className="mr-2 h-4 w-4" /> {t("commercial.commande_detail.valider")}
              </Button>
            )}
            {brouillon && can("commande.update") && (
              <Button variant="outline" onClick={() => setDialogue("modifier")}>
                <Pencil className="mr-2 h-4 w-4" /> {t("commercial.commande_detail.modifier")}
              </Button>
            )}
            {annulable && can("commande.update") && (
              <Button variant="outline" onClick={() => setDialogue("annuler")}>
                <Ban className="mr-2 h-4 w-4" /> {t("commercial.commande_detail.annuler")}
              </Button>
            )}
            {brouillon && can("commande.delete") && (
              <Button variant="outline" onClick={() => setDialogue("supprimer")}>
                <Trash2 className="mr-2 h-4 w-4 text-destructive" /> {t("commercial.commande_detail.supprimer")}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">{t("commercial.commande_detail.carte_client")}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Link href={`/clients/${commande.client}`} className="font-medium hover:underline">{commande.nom_client}</Link>
              <TypeBadge type={commande.type_client} />
            </div>
            {commande.num_devis && (
              <div><p className="text-xs text-muted-foreground">{t("commercial.commande_detail.lbl_devis_source")}</p><p className="font-medium">{commande.num_devis}</p></div>
            )}
            {soa && (
              <div>
                <p className="text-xs text-muted-foreground">{t("commercial.commande_detail.lbl_engagement")}</p>
                {commande.num_engagement_cf ? (
                  <p className="font-medium">{commande.num_engagement_cf}</p>
                ) : (
                  <p className="text-amber-700">
                    {brouillon ? t("commercial.commande_detail.sans_engagement_brouillon") : `${t("commercial.commande_detail.sans_engagement")}.`}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{t("commercial.commande_detail.carte_suite")}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {commande.statut_commande === "VALIDEE" && (
              <p>
                {t("commercial.commande_detail.validee_magasin")}
                {can("preparation.create") && (
                  <> <Link href="/commercial/preparations" className="underline">{t("commercial.commande_detail.aller_preparations")}</Link></>
                )}
              </p>
            )}
            {preparation && <p>{t("commercial.commande_detail.preparation_prefixe")}<StatusBadge statut={preparation.statut_prepa} /></p>}
            {facture && (
              <p>
                {t("commercial.commande_detail.facture_prefixe")}<Link href={`/commercial/factures/${facture.id_facture}`} className="font-medium hover:underline">{facture.num_facture}</Link>{" "}
                <StatusBadge statut={facture.statut_paiement} />
              </p>
            )}
            {commande.statut_commande === "LIVREE" && !facture && <p>{t("commercial.commande_detail.livree_attente")}</p>}
            {brouillon && <p className="text-muted-foreground">{t("commercial.commande_detail.brouillon_info")}</p>}
            {commande.statut_commande === "ANNULEE" && <p className="text-muted-foreground">{t("commercial.commande_detail.annulee_info")}</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("commercial.commande_detail.carte_lignes")}</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("commercial.commande_detail.col_produit")}</TableHead>
                  <TableHead className="text-right">{t("commercial.commande_detail.col_qte")}</TableHead>
                  <TableHead className="text-right">{t("commercial.commande_detail.col_pu")}</TableHead>
                  <TableHead className="text-right">{t("commercial.commande_detail.col_montant")}</TableHead>
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
                  <TableCell colSpan={3} className="text-right font-medium">{t("commercial.commande_detail.total_ht")}</TableCell>
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
        title={t("commercial.commande_detail.dlg_valider_titre")}
        description={
          soa
            ? t("commercial.commande_detail.dlg_valider_soa", { x: formatAr(commande.total) })
            : commande.type_client === "PRIVE"
              ? t("commercial.commande_detail.dlg_valider_prive")
              : t("commercial.commande_detail.dlg_valider_defaut")
        }
        confirmLabel={t("commercial.commande_detail.dlg_valider_btn")}
        loading={valider.isPending}
        onConfirm={() => agir("valider")}
      />
      <ConfirmDialog
        open={dialogue === "annuler"}
        onOpenChange={(o) => !o && setDialogue(null)}
        title={t("commercial.commande_detail.dlg_annuler_titre")}
        description={
          soa && commande.statut_commande === "VALIDEE"
            ? t("commercial.commande_detail.dlg_annuler_soa")
            : t("commercial.commande_detail.dlg_annuler_defaut")
        }
        confirmLabel={t("commercial.commande_detail.dlg_annuler_btn")}
        destructive
        loading={annuler.isPending}
        onConfirm={() => agir("annuler")}
      />
      <ConfirmDialog
        open={dialogue === "supprimer"}
        onOpenChange={(o) => !o && setDialogue(null)}
        title={t("commercial.commande_detail.dlg_suppr_titre")}
        description={t("commercial.commande_detail.dlg_suppr_desc")}
        confirmLabel={t("commercial.commande_detail.dlg_suppr_btn")}
        destructive
        loading={crud.remove.isPending}
        onConfirm={supprimer}
      />
    </div>
  );
}
