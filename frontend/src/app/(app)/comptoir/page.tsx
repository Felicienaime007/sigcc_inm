"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Plus, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RequirePrivilege } from "@/components/can";
import { PageHeader } from "@/components/page-header";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import { ClientSearch } from "@/components/clients/client-search";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { TVA_TAUX, entierPositif } from "@/lib/commercial";
import { getErrorMessage } from "@/lib/errors";
import { formatAr, formatNombre } from "@/lib/format";
import { useApiMutation, useOptions } from "@/lib/resource";
import type { Client } from "@/types/clients";
import type { Facture, Produit, StockResume } from "@/types/commercial";

interface LigneVente {
  produit: Produit;
  quantite: string;
}

export default function ComptoirPage() {
  return (
    <RequirePrivilege privilege="client_simple.create">
      <Contenu />
    </RequirePrivilege>
  );
}

function Contenu() {
  const router = useRouter();
  const { can } = useAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [nouveauClient, setNouveauClient] = useState(false);
  const [lignes, setLignes] = useState<LigneVente[]>([]);
  const [produitId, setProduitId] = useState("");
  const [quantite, setQuantite] = useState("1");
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<Facture | null>(null);

  const { data: produits } = useOptions<Produit>("produits");
  // Stock disponible par produit (rafraîchi régulièrement : les autres rôles le font varier)
  const stock = useQuery({
    queryKey: ["stock/lignes", "resume"],
    queryFn: async () => (await api.get<StockResume[]>("/stock/lignes/resume/")).data,
    enabled: can("stock.view"),
    refetchInterval: 15_000,
  });
  const stockConnu = stock.data !== undefined;
  const disponible = useMemo(() => {
    const m = new Map<number, number>();
    stock.data?.forEach((s) => m.set(s.produit, s.quantite_disponible));
    return m;
  }, [stock.data]);
  const dispo = (id: number) => (stockConnu ? (disponible.get(id) ?? 0) : Infinity);

  const creer = useApiMutation(
    async (body: unknown) => (await api.post<Facture>("/commercial/factures/", body)).data,
    { silentError: true },
  );

  const totalHt = lignes.reduce((s, l) => s + (entierPositif(l.quantite) ?? 0) * Number(l.produit.prix_tarif), 0);
  const tva = Math.round(totalHt * TVA_TAUX * 100) / 100;

  function ajouter() {
    setErreur(null);
    const produit = produits?.find((p) => String(p.id_produit) === produitId);
    if (!produit) return setErreur("Choisissez un produit.");
    const q = entierPositif(quantite);
    if (q === null) return setErreur("La quantité doit être un entier supérieur à 0.");

    const existante = lignes.find((l) => l.produit.id_produit === produit.id_produit);
    const total = (existante ? (entierPositif(existante.quantite) ?? 0) : 0) + q;
    if (total > dispo(produit.id_produit)) {
      return setErreur(`${produit.code_produit} : stock insuffisant (disponible ${dispo(produit.id_produit)}).`);
    }
    setLignes((ls) =>
      existante
        ? ls.map((l) => (l === existante ? { ...l, quantite: String(total) } : l))
        : [...ls, { produit, quantite: String(q) }],
    );
    setProduitId("");
    setQuantite("1");
  }

  async function valider() {
    setErreur(null);
    if (!client) return setErreur("Sélectionnez ou créez le client.");
    if (lignes.length === 0) return setErreur("Ajoutez au moins un produit.");
    for (const l of lignes) {
      const q = entierPositif(l.quantite);
      if (q === null) return setErreur(`${l.produit.code_produit} : quantité invalide.`);
      if (q > dispo(l.produit.id_produit)) {
        return setErreur(`${l.produit.code_produit} : stock insuffisant (disponible ${dispo(l.produit.id_produit)}).`);
      }
    }
    try {
      const facture = await creer.mutateAsync({
        client: client.id_client,
        lignes: lignes.map((l) => ({
          produit: l.produit.id_produit,
          quantite_facturee: entierPositif(l.quantite),
        })),
      });
      setResultat(facture);
    } catch (e) {
      setErreur(getErrorMessage(e));
    }
  }

  function nouvelleVente() {
    setClient(null);
    setLignes([]);
    setResultat(null);
    setErreur(null);
  }

  // ------------------------------------------------------------ Facture créée
  if (resultat) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <Card>
          <CardContent className="space-y-4 pt-6 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
            <div>
              <h2 className="text-xl font-semibold">Facture {resultat.num_facture}</h2>
              <p className="text-sm text-muted-foreground">
                Transmise au caissier pour encaissement · Client : {resultat.nom_client}
              </p>
            </div>
            <div className="rounded-md border p-4 text-sm">
              <div className="flex justify-between"><span>Total HT</span><span className="tabular-nums">{formatAr(resultat.montant_ht)}</span></div>
              <div className="flex justify-between"><span>TVA</span><span className="tabular-nums">{formatAr(resultat.tva)}</span></div>
              <div className="mt-2 flex justify-between border-t pt-2 text-base font-semibold">
                <span>Total à payer</span><span className="tabular-nums">{formatAr(resultat.montant_ttc)}</span>
              </div>
            </div>
            <p className="text-sm">Le client se présente à la caisse avec ce numéro de facture.</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={nouvelleVente}>
                <Plus className="mr-2 h-4 w-4" /> Nouvelle vente
              </Button>
              <Button variant="outline" onClick={() => router.push(`/commercial/factures/${resultat.id_facture}`)}>
                Voir la facture
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ----------------------------------------------------------------- Saisie
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Vente au comptoir"
        description="Client de passage, produits livrables directement. La facture est transmise au caissier."
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">1. Client</CardTitle>
          {!client && (
            <Button variant="outline" size="sm" onClick={() => setNouveauClient(true)}>
              <UserPlus className="mr-2 h-4 w-4" /> Nouveau client
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <ClientSearch value={client} onChange={setClient} params={{ type_client: "SIMPLE" }} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">2. Produits</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-64 flex-1">
              <p className="mb-1.5 text-xs text-muted-foreground">Produit</p>
              <Select value={produitId} onValueChange={(v) => setProduitId(v ?? "")}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Choisir un produit…" /></SelectTrigger>
                <SelectContent>
                  {produits?.map((p) => {
                    const d = dispo(p.id_produit);
                    return (
                      <SelectItem key={p.id_produit} value={String(p.id_produit)} disabled={d <= 0}>
                        {p.code_produit} — {p.designation} ({formatAr(p.prix_tarif)}
                        {stockConnu ? `, dispo ${d}` : ""})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="w-28">
              <p className="mb-1.5 text-xs text-muted-foreground">Quantité</p>
              <Input
                inputMode="numeric" className="text-right" value={quantite}
                onChange={(e) => setQuantite(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && ajouter()}
              />
            </div>
            <Button type="button" onClick={ajouter}>
              <Plus className="mr-2 h-4 w-4" /> Ajouter
            </Button>
          </div>

          {lignes.length > 0 && (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead className="text-right">Prix unitaire</TableHead>
                    <TableHead className="w-28 text-right">Quantité</TableHead>
                    <TableHead className="text-right">Montant HT</TableHead>
                    <TableHead className="w-px" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lignes.map((l) => {
                    const q = entierPositif(l.quantite);
                    const d = dispo(l.produit.id_produit);
                    return (
                      <TableRow key={l.produit.id_produit}>
                        <TableCell>
                          <p className="font-medium">{l.produit.designation}</p>
                          <p className="text-xs text-muted-foreground">
                            {l.produit.code_produit}{stockConnu ? ` · dispo ${formatNombre(d)}` : ""}
                          </p>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatAr(l.produit.prix_tarif)}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            inputMode="numeric" className="text-right"
                            aria-invalid={q === null || q > d}
                            value={l.quantite}
                            onChange={(e) =>
                              setLignes((ls) => ls.map((x) => (x === l ? { ...x, quantite: e.target.value } : x)))
                            }
                          />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatAr((q ?? 0) * Number(l.produit.prix_tarif))}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost" size="icon" title="Retirer"
                            onClick={() => setLignes((ls) => ls.filter((x) => x !== l))}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">3. Récapitulatif</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="ml-auto max-w-xs text-sm">
            <div className="flex justify-between"><span>Total HT</span><span className="tabular-nums">{formatAr(totalHt)}</span></div>
            <div className="flex justify-between"><span>TVA ({Math.round(TVA_TAUX * 100)} %)</span><span className="tabular-nums">{formatAr(tva)}</span></div>
            <div className="mt-2 flex justify-between border-t pt-2 text-base font-semibold">
              <span>Total TTC</span><span className="tabular-nums">{formatAr(totalHt + tva)}</span>
            </div>
            <p className="mt-1 text-right text-xs text-muted-foreground">Estimation : le montant exact est calculé à la création.</p>
          </div>

          {erreur && (
            <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{erreur}</p>
          )}

          <div className="flex justify-end">
            <Button size="lg" onClick={valider} disabled={creer.isPending}>
              {creer.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Générer la facture
            </Button>
          </div>
        </CardContent>
      </Card>

      <ClientFormDialog
        open={nouveauClient}
        onOpenChange={setNouveauClient}
        client={null}
        typeImpose="SIMPLE"
        onSaved={(c) => setClient(c)}
      />
    </div>
  );
}