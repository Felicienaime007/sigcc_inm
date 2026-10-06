"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Truck, Undo2, Banknote, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RequirePrivilege } from "@/components/can";
import { AvoirDialog } from "@/components/commercial/avoir-dialog";
import { StatusBadge } from "@/components/data/status-badge";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { libelleFacturation } from "@/lib/commercial";
import { getErrorMessage } from "@/lib/errors";
import { formatAr, formatDate, formatDateTime, formatNombre } from "@/lib/format";
import { useApiMutation, useDetail, useList } from "@/lib/resource";
import type { Avoir, Facture } from "@/types/commercial";
import { ReglementDialog } from "@/components/data/tresorie/reglement-dialog";
import { libelleMode, type Reglement } from "@/types/tresorie";
import { HistoriqueButton } from "@/components/audit/history-button";
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

  const livraison = useApiMutation(
    async () => (await api.post("/commercial/livraisons/", { facture: Number(id) })).data,
    { success: "Bon de livraison créé, stock mis à jour." },
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
        <p className="text-destructive">{getErrorMessage(error, "Facture introuvable.")}</p>
        <Button variant="outline" onClick={() => router.push("/commercial/factures")}>Retour à la liste</Button>
      </div>
    );
  }

  const comptoir = facture.commande === null;
  const reste = Number(facture.reste_a_payer);
  const peutEncaisser = facture.type_facturation === "QUITTANCE" && reste > 0 && can("reglement.encaisser");
  const peutVirement = facture.type_facturation === "VIREMENT_TRESOR" && reste > 0 && can("reglement.virement");
  const peutLivrer = comptoir && facture.statut_paiement === "PAYEE" && facture.id_livraison === null && can("livraison.create");

  async function confirmerLivraison() {
    try {
      await livraison.mutateAsync(undefined);
    } catch {
      /* message du serveur (ex. stock insuffisant) déjà affiché en notification */
    }
    setLivrer(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/commercial/factures" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Factures
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">{facture.num_facture}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <StatusBadge statut={facture.statut_paiement} />
              <span>{libelleFacturation(facture.type_facturation)}</span>
              <span>· {formatDateTime(facture.date_facture)}</span>
            </div>
          </div>
          <HistoriqueButton table="facture" objet={facture.id_facture} titre={facture.num_facture} />
          <div className="flex flex-wrap gap-2">
            {peutLivrer && (
              <Button onClick={() => setLivrer(true)}>
                <Truck className="mr-2 h-4 w-4" /> Livrer
              </Button>
              
            )}
                        {peutEncaisser && (
              <Button onClick={() => setReglementMode("caisse")}>
                <Banknote className="mr-2 h-4 w-4" /> Encaisser
              </Button>
            )}
            {peutVirement && (
              <Button onClick={() => setReglementMode("virement")}>
                <Landmark className="mr-2 h-4 w-4" /> Enregistrer le virement
              </Button>
            )}
            {can("avoir.create") && (
              <Button variant="outline" onClick={() => setAvoirOuvert(true)}>
                <Undo2 className="mr-2 h-4 w-4" /> Créer un avoir
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Client et origine</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div><p className="text-xs text-muted-foreground">Client</p><p className="font-medium">{facture.nom_client}</p></div>
            <div>
              <p className="text-xs text-muted-foreground">Origine</p>
              <p className="font-medium">{comptoir ? "Vente au comptoir" : `Commande ${facture.num_commande}`}</p>
            </div>
            {facture.id_livraison !== null && (
              <p className="text-green-700">Livrée (bon de livraison n° {facture.id_livraison})</p>
            )}
            {comptoir && facture.statut_paiement !== "PAYEE" && (
              <p className="text-amber-700">En attente d&apos;encaissement à la caisse.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Montants</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Montant label="Total HT" valeur={facture.montant_ht} />
            <Montant label="TVA" valeur={facture.tva} />
            <Montant label="Total TTC" valeur={facture.montant_ttc} fort />
            <div className="pt-3" />
            <Montant label="Déjà réglé" valeur={facture.total_regle} />
            <Montant label="Reste à payer" valeur={facture.reste_a_payer} fort />
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
          <CardHeader><CardTitle className="text-base">Avoirs émis</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {avoirs.data!.results.map((a) => (
              <div key={a.id_avoir} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                <div>
                  <p className="font-medium">{a.num_avoir} · {formatDate(a.date_avoir)}</p>
                  <p className="text-xs text-muted-foreground">{a.motif}</p>
                </div>
                <span className="font-medium tabular-nums">{formatAr(a.total_avoir)} HT</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
            {can("reglement.view") && (reglements.data?.results.length ?? 0) > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Règlements</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {reglements.data!.results.map((r) => (
              <div key={r.id_reglement} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                <div>
                  <p className="font-medium">{libelleMode(r.mode_reglement)} · {formatDateTime(r.date_reglement)}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.quittance
                      ? `Quittance ${r.quittance.numero_livre} · feuille ${r.quittance.num_feuille} · volet ${r.quittance.attribut_volet}`
                      : r.num_virement_tresor}
                  </p>
                </div>
                <span className="font-medium tabular-nums">{formatAr(r.montant_regle)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <AvoirDialog open={avoirOuvert} onOpenChange={setAvoirOuvert} facture={facture} deja={deja} />

      <ConfirmDialog
        open={livrer}
        onOpenChange={setLivrer}
        title="Confirmer la livraison ?"
        description="Le bon de livraison est créé et les produits sortent du stock. Cette action ne s'annule pas."
        confirmLabel="Livrer"
        loading={livraison.isPending}
        onConfirm={confirmerLivraison}
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