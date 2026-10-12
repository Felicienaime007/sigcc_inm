"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Truck, Undo2, Banknote, Landmark, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RequirePrivilege } from "@/components/can";
import { AvoirDialog } from "@/components/commercial/avoir-dialog";
import { StatusBadge } from "@/components/data/status-badge";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { DangerConfirm } from "@/components/forms/danger-confirm";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { libelleFacturation } from "@/lib/commercial";
import { getErrorMessage } from "@/lib/errors";
import { formatAr, formatDate, formatDateTime, formatNombre } from "@/lib/format";
import { useApiMutation, useDetail, useList } from "@/lib/resource";
import { useT } from "@/lib/i18n/contexte";
import type { Avoir, Facture } from "@/types/commercial";
import { ReglementDialog } from "@/components/data/tresorie/reglement-dialog";
import { libelleMode, type Reglement } from "@/types/tresorie";
import { HistoriqueButton } from "@/components/audit/history-button";
import { ImprimerButton } from "@/components/editions/imprimer-button";
export default function FactureDetailPage() {
  return (
    <RequirePrivilege privilege="facture.view">
      <Contenu />
    </RequirePrivilege>
  );
}

function Montant({ label, valeur, fort }: { label: string; valeur: string; fort?: boolean }) {
  return (
    <div className={`flex justify-between ${fort ? "border-t pt-2 text-base font-semibold" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">{formatAr(valeur)}</span>
    </div>
  );
}

function Contenu() {
  const { t } = useT();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useAuth();
  const { data: facture, isLoading, error } = useDetail<Facture>("commercial/factures", id);
  // Actualisation du statut de paiement et du reste à payer (encaissement fait ailleurs)
  const avoirs = useList<Avoir>("commercial/avoirs", { facture: id, page_size: 100 }, can("avoir.view"));
  const reglements = useList<Reglement>("tresorerie/reglements", { facture: id, page_size: 100 }, can("reglement.view"));
  const [reglementMode, setReglementMode] = useState<"caisse" | "virement" | null>(null);
  const [avoirOuvert, setAvoirOuvert] = useState(false);
  const [livrer, setLivrer] = useState(false);
  const [annuler, setAnnuler] = useState(false);
  const [erreurAnnulation, setErreurAnnulation] = useState<string | null>(null);

  const livraison = useApiMutation(
    async () => (await api.post("/commercial/livraisons/", { facture: Number(id) })).data,
    { success: t("commercial.facture_detail.succes_bl") },
  );

  const annulation = useApiMutation(
    async (body: { motif: string }) =>
      (await api.post(`/commercial/factures/${id}/annuler/`, body)).data,
    { success: t("commercial.facture_detail.succes_annulee") },
  );

  const deja = useMemo(() => {
    const m: Record<number, number> = {};
    avoirs.data?.results.forEach((a) =>
      a.lignes.forEach((l) => (m[l.produit] = (m[l.produit] ?? 0) + l.quantite_retournee)),
    );
    return m;
  }, [avoirs.data]);

  if (isLoading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (error || !facture) {
    return (
      <div className="space-y-3 py-16 text-center">
        <p className="text-destructive">{getErrorMessage(error, t("commercial.facture_detail.err_introuvable"))}</p>
        <Button variant="outline" onClick={() => router.push("/commercial/factures")}>{t("commercial.facture_detail.retour_liste")}</Button>
      </div>
    );
  }

  const comptoir = facture.commande === null;
  const reste = Number(facture.reste_a_payer);
  const peutEncaisser = facture.type_facturation === "QUITTANCE" && reste > 0 && can("reglement.encaisser");
  const peutVirement = facture.type_facturation === "VIREMENT_TRESOR" && reste > 0 && can("reglement.virement");
  const peutLivrer = comptoir && facture.statut_paiement === "PAYEE" && facture.id_livraison === null && can("livraison.create");
  const peutAnnuler = facture.statut_paiement === "NON_PAYEE" && can("facture.annuler");

  async function confirmerLivraison() {
    try {
      await livraison.mutateAsync(undefined);
    } catch {
      /* message du serveur (ex. stock insuffisant) déjà affiché en notification */
    }
    setLivrer(false);
  }

  async function confirmerAnnulation(motif: string) {
    setErreurAnnulation(null);
    if (!motif.trim()) return setErreurAnnulation(t("commercial.facture_detail.err_motif_obligatoire"));
    try {
      await annulation.mutateAsync({ motif: motif.trim() });
      setAnnuler(false);
    } catch (e) {
      setErreurAnnulation(getErrorMessage(e));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/commercial/factures" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {t("commercial.facture_detail.fil_factures")}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">{facture.num_facture}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <StatusBadge statut={facture.statut_paiement} />
              <span>{libelleFacturation(facture.type_facturation, t)}</span>
              <span>· {formatDateTime(facture.date_facture)}</span>
            </div>
          </div>
          <HistoriqueButton table="facture" objet={facture.id_facture} titre={facture.num_facture} />
          <div className="flex flex-wrap gap-2">
            <ImprimerButton chemin={`facture/${facture.id_facture}`} libelle={t("commercial.facture_detail.imprimer_facture")} />
            {facture.id_livraison !== null && can("livraison.view") && (
              <ImprimerButton chemin={`livraison/${facture.id_livraison}`} libelle={t("commercial.facture_detail.imprimer_bl")} />
            )}
            {peutLivrer && (
              <Button onClick={() => setLivrer(true)}>
                <Truck className="mr-2 h-4 w-4" /> {t("commercial.facture_detail.livrer")}
              </Button>

            )}
                        {peutEncaisser && (
              <Button onClick={() => setReglementMode("caisse")}>
                <Banknote className="mr-2 h-4 w-4" /> {t("commercial.facture_detail.encaisser")}
              </Button>
            )}
            {peutVirement && (
              <Button onClick={() => setReglementMode("virement")}>
                <Landmark className="mr-2 h-4 w-4" /> {t("commercial.facture_detail.virement")}
              </Button>
            )}
            {can("avoir.create") && (
              <Button variant="outline" onClick={() => setAvoirOuvert(true)}>
                <Undo2 className="mr-2 h-4 w-4" /> {t("commercial.facture_detail.creer_avoir")}
              </Button>
            )}
            {peutAnnuler && (
                <Button variant="outline" className="text-destructive" onClick={() => { setErreurAnnulation(null); setAnnuler(true); }}>
                <XCircle className="mr-2 h-4 w-4" /> {t("commercial.facture_detail.annuler_facture")}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">{t("commercial.facture_detail.carte_client")}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div><p className="text-xs text-muted-foreground">{t("commercial.facture_detail.lbl_client")}</p><p className="font-medium">{facture.nom_client}</p></div>
            <div>
              <p className="text-xs text-muted-foreground">{t("commercial.facture_detail.lbl_origine")}</p>
              <p className="font-medium">{comptoir ? t("commercial.facture_detail.origine_comptoir") : t("commercial.facture_detail.origine_commande", { x: facture.num_commande ?? "" })}</p>
            </div>
            {facture.id_livraison !== null && (
              <p className="text-green-700">{t("commercial.facture_detail.livree_bl", { x: facture.id_livraison })}</p>
            )}
            {facture.statut_paiement === "ANNULEE" && (
              <p className="text-destructive">
                {t("commercial.facture_detail.annulee_le", { date: facture.date_annulation ? formatDate(facture.date_annulation) : "—" })}
                {facture.motif_annulation ? t("commercial.facture_detail.annulee_motif", { x: facture.motif_annulation }) : ""}
              </p>
            )}
            {comptoir && facture.statut_paiement !== "PAYEE" && (
              <p className="text-amber-700">{t("commercial.facture_detail.attente_caisse")}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{t("commercial.facture_detail.carte_montants")}</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Montant label={t("commercial.facture_detail.m_ht")} valeur={facture.montant_ht} />
            <Montant label={t("commercial.facture_detail.m_tva")} valeur={facture.tva} />
            <Montant label={t("commercial.facture_detail.m_ttc")} valeur={facture.montant_ttc} fort />
            <div className="pt-3" />
            <Montant label={t("commercial.facture_detail.m_regle")} valeur={facture.total_regle} />
            <Montant label={t("commercial.facture_detail.m_reste")} valeur={facture.reste_a_payer} fort />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("commercial.facture_detail.carte_lignes")}</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("commercial.facture_detail.col_produit")}</TableHead>
                  <TableHead className="text-right">{t("commercial.facture_detail.col_qte")}</TableHead>
                  <TableHead className="text-right">{t("commercial.facture_detail.col_pu")}</TableHead>
                  <TableHead className="text-right">{t("commercial.facture_detail.col_montant")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {facture.lignes.map((l) => (
                  <TableRow key={l.produit}>
                    <TableCell>
                      <p className="font-medium">{l.designation}</p>
                      <p className="text-xs text-muted-foreground">{l.code_produit}</p>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNombre(l.quantite_facturee)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatAr(l.prix_unitaire)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatAr(l.quantite_facturee * Number(l.prix_unitaire))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {can("avoir.view") && (avoirs.data?.results.length ?? 0) > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">{t("commercial.facture_detail.carte_avoirs")}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {avoirs.data!.results.map((a) => (
              <div key={a.id_avoir} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                <div>
                  <p className="font-medium">{a.num_avoir} · {formatDate(a.date_avoir)}</p>
                  <p className="text-xs text-muted-foreground">{a.motif}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium tabular-nums">{formatAr(a.total_avoir)}{t("commercial.facture_detail.suffixe_ht")}</span>
                  <ImprimerButton icone chemin={`avoir/${a.id_avoir}`} libelle={t("commercial.facture_detail.imprimer_avoir")} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
            {can("reglement.view") && (reglements.data?.results.length ?? 0) > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">{t("commercial.facture_detail.carte_reglements")}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {reglements.data!.results.map((r) => (
              <div key={r.id_reglement} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                <div>
                  <p className="font-medium">{t(libelleMode(r.mode_reglement))} · {formatDateTime(r.date_reglement)}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.quittance
                      ? t("commercial.facture_detail.quittance_detail", { n: r.quittance.numero_livre, f: r.quittance.num_feuille, v: r.quittance.attribut_volet })
                      : r.num_virement_tresor}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium tabular-nums">{formatAr(r.montant_regle)}</span>
                  <ImprimerButton icone chemin={`reglement/${r.id_reglement}`} libelle={t("commercial.facture_detail.imprimer_recu")} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <AvoirDialog open={avoirOuvert} onOpenChange={setAvoirOuvert} facture={facture} deja={deja} />

      <ConfirmDialog
        open={livrer}
        onOpenChange={setLivrer}
        title={t("commercial.facture_detail.confirm_liv_titre")}
        description={t("commercial.facture_detail.confirm_liv_desc")}
        confirmLabel={t("commercial.facture_detail.confirm_liv_btn")}
        loading={livraison.isPending}
        onConfirm={confirmerLivraison}
      />
      <DangerConfirm
        open={annuler}
        onOpenChange={setAnnuler}
        title={t("commercial.facture_detail.ann_titre", { x: facture.num_facture })}
        description={t("commercial.facture_detail.ann_desc")}
        effetFinancier={t("commercial.facture_detail.ann_effet", { x: facture.num_facture, montant: formatAr(facture.montant_ttc) })}
        requireText={facture.num_facture}
        motifLabel={t("commercial.facture_detail.ann_champ")}
        motifPlaceholder={t("commercial.facture_detail.ann_ph")}
        motifRequired
        confirmLabel={t("commercial.facture_detail.ann_btn")}
        loading={annulation.isPending}
        error={erreurAnnulation}
        onConfirm={(motif) => void confirmerAnnulation(motif)}
      />
            {reglementMode && (
        <ReglementDialog
          open
          onOpenChange={(o) => !o && setReglementMode(null)}
          facture={facture}
          mode={reglementMode}
        />
      )}
    </div>
  );
}
