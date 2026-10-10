"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Plus, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RequirePrivilege } from "@/components/can";
import { ImprimerButton } from "@/components/editions/imprimer-button";
import { PageHeader } from "@/components/page-header";
import { Kbd } from "@/components/kbd";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import { ClientSearch } from "@/components/clients/client-search";
import { TypeBadge } from "@/components/clients/type-badge";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { TVA_TAUX, entierPositif } from "@/lib/commercial";
import { getErrorMessage } from "@/lib/errors";
import { formatAr, formatNombre } from "@/lib/format";
import { useApiMutation, useOptions } from "@/lib/resource";
import { useT } from "@/lib/i18n/contexte";
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
  const { t } = useT();
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
  const libelleProduit = (p: Produit) => {
    const d = dispo(p.id_produit);
    return `${p.code_produit} — ${p.designation} (${formatAr(p.prix_tarif)}${stockConnu ? t("commercial.comptoir.dispo_option", { x: d }) : ""})`;
  };

  const creer = useApiMutation(
    async (body: unknown) => (await api.post<Facture>("/commercial/factures/", body)).data,
    { silentError: true },
  );

  const totalHt = lignes.reduce((s, l) => s + (entierPositif(l.quantite) ?? 0) * Number(l.produit.prix_tarif), 0);
  const tva = Math.round(totalHt * TVA_TAUX * 100) / 100;

  function ajouter() {
    setErreur(null);
    const produit = produits?.find((p) => String(p.id_produit) === produitId);
    if (!produit) return setErreur(t("commercial.comptoir.err_choisir_produit"));
    const q = entierPositif(quantite);
    if (q === null) return setErreur(t("commercial.comptoir.err_qte_invalide"));

    const existante = lignes.find((l) => l.produit.id_produit === produit.id_produit);
    const total = (existante ? (entierPositif(existante.quantite) ?? 0) : 0) + q;
    if (total > dispo(produit.id_produit)) {
      return setErreur(t("commercial.comptoir.err_stock", { code: produit.code_produit, dispo: dispo(produit.id_produit) }));
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
    if (!client) return setErreur(t("commercial.comptoir.err_client"));
    if (lignes.length === 0) return setErreur(t("commercial.comptoir.err_aucun_produit"));
    for (const l of lignes) {
      const q = entierPositif(l.quantite);
      if (q === null) return setErreur(t("commercial.comptoir.err_qte_code", { code: l.produit.code_produit }));
      if (q > dispo(l.produit.id_produit)) {
        return setErreur(t("commercial.comptoir.err_stock", { code: l.produit.code_produit, dispo: dispo(l.produit.id_produit) }));
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

  // Raccourcis comptoir : F2 = choisir un produit, F9 = générer la facture.
  useEffect(() => {
    function touches(e: KeyboardEvent) {
      const cible = e.target as HTMLElement | null;
      const enSaisie = cible && ["INPUT", "TEXTAREA", "SELECT"].includes(cible.tagName);
      if (e.key === "F9") {
        e.preventDefault();
        if (!resultat && !creer.isPending) void valider();
      } else if (e.key === "F2" && !resultat) {
        e.preventDefault();
        document.querySelector<HTMLButtonElement>("#comptoir-produit button")?.focus();
      } else if (enSaisie) {
        return;
      }
    }
    window.addEventListener("keydown", touches);
    return () => window.removeEventListener("keydown", touches);
  });

  // ------------------------------------------------------------ Facture créée
  if (resultat) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <Card>
          <CardContent className="space-y-4 pt-6 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
            <div>
              <h2 className="text-xl font-semibold">{t("commercial.comptoir.facture_prefixe", { x: resultat.num_facture })}</h2>
              <p className="text-sm text-muted-foreground">
                {t("commercial.comptoir.transmise", { x: resultat.nom_client })}
              </p>
            </div>
            <div className="rounded-md border p-4 text-sm">
              <div className="flex justify-between"><span>{t("commercial.comptoir.total_ht")}</span><span className="tabular-nums">{formatAr(resultat.montant_ht)}</span></div>
              <div className="flex justify-between"><span>{t("commercial.comptoir.tva")}</span><span className="tabular-nums">{formatAr(resultat.tva)}</span></div>
              <div className="mt-2 flex justify-between border-t pt-2 text-base font-semibold">
                <span>{t("commercial.comptoir.total_payer")}</span><span className="tabular-nums">{formatAr(resultat.montant_ttc)}</span>
              </div>
            </div>
            <p className="text-sm">{t("commercial.comptoir.consigne")}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={nouvelleVente}>
                <Plus className="mr-2 h-4 w-4" /> {t("commercial.comptoir.nouvelle_vente")}
              </Button>
              <ImprimerButton variant="default" chemin={`facture/${resultat.id_facture}`} libelle={t("commercial.comptoir.imprimer")} />
              {can("facture.view") && (
                <Button variant="outline" onClick={() => router.push(`/commercial/factures/${resultat.id_facture}`)}>
                  {t("commercial.comptoir.voir_facture")}
                </Button>
              )}
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
        title={t("commercial.comptoir.titre")}
        description={t("commercial.comptoir.description")}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{t("commercial.comptoir.etape_client")}</CardTitle>
          {!client && (
            <Button variant="outline" size="sm" onClick={() => setNouveauClient(true)}>
              <UserPlus className="mr-2 h-4 w-4" /> {t("commercial.comptoir.nouveau_client")}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <ClientSearch value={client} onChange={setClient} params={{ type_client: "SIMPLE" }} />
          {client && (
            <div className="mt-4 overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("commercial.comptoir.col_client")}</TableHead>
                    <TableHead>{t("commercial.comptoir.col_type")}</TableHead>
                    <TableHead>{t("commercial.comptoir.col_ville")}</TableHead>
                    <TableHead>{t("commercial.comptoir.col_tel")}</TableHead>
                    <TableHead>{t("commercial.comptoir.col_cin")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">{client.nom_client}</TableCell>
                    <TableCell><TypeBadge type={client.type_client} /></TableCell>
                    <TableCell>{client.ville ?? "—"}</TableCell>
                    <TableCell>{client.telephone ?? "—"}</TableCell>
                    <TableCell>{client.cin_ou_nif ?? "—"}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{t("commercial.comptoir.etape_produits")}</CardTitle>
          <p className="text-xs text-muted-foreground">
            <Kbd>F2</Kbd> {t("commercial.comptoir.raccourci_produits")} <Kbd>Entrée</Kbd> {t("commercial.comptoir.raccourci_ajouter")}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-64 flex-1" id="comptoir-produit">
              <p className="mb-1.5 text-xs text-muted-foreground">{t("commercial.comptoir.lbl_produit")}</p>
              <Select
                value={produitId}
                onValueChange={(v) => setProduitId(v ?? "")}
                items={Object.fromEntries((produits ?? []).map((p) => [String(p.id_produit), libelleProduit(p)]))}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder={t("commercial.comptoir.ph_produit")} /></SelectTrigger>
                <SelectContent>
                  {produits?.map((p) => {
                    const d = dispo(p.id_produit);
                    return (
                      <SelectItem key={p.id_produit} value={String(p.id_produit)} disabled={d <= 0}>
                        {libelleProduit(p)}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="w-28">
              <p className="mb-1.5 text-xs text-muted-foreground">{t("commercial.comptoir.lbl_quantite")}</p>
              <Input
                inputMode="numeric" className="text-right" value={quantite}
                onChange={(e) => setQuantite(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); ajouter(); } }}
              />
            </div>
            <Button type="button" onClick={ajouter}>
              <Plus className="mr-2 h-4 w-4" /> {t("commercial.comptoir.ajouter")}
            </Button>
          </div>

          {lignes.length > 0 && (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("commercial.comptoir.lbl_produit")}</TableHead>
                    <TableHead className="text-right">{t("commercial.comptoir.col_pu")}</TableHead>
                    <TableHead className="w-28 text-right">{t("commercial.comptoir.lbl_quantite")}</TableHead>
                    <TableHead className="text-right">{t("commercial.comptoir.col_montant")}</TableHead>
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
                            {l.produit.code_produit}{stockConnu ? t("commercial.comptoir.dispo_suffixe", { x: formatNombre(d) }) : ""}
                          </p>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatAr(l.produit.prix_tarif)}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            inputMode="numeric" className="text-right"
                            aria-label={t("commercial.comptoir.aria_qte", { x: l.produit.code_produit })}
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
                            variant="ghost" size="icon" title={t("commercial.comptoir.retirer")} aria-label={t("commercial.comptoir.retirer")}
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
        <CardHeader><CardTitle className="text-base">{t("commercial.comptoir.etape_recap")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="ml-auto max-w-xs text-sm">
            <div className="flex justify-between"><span>{t("commercial.comptoir.total_ht")}</span><span className="tabular-nums">{formatAr(totalHt)}</span></div>
            <div className="flex justify-between"><span>{t("commercial.comptoir.tva_pct", { x: Math.round(TVA_TAUX * 100) })}</span><span className="tabular-nums">{formatAr(tva)}</span></div>
            <div className="mt-2 flex justify-between border-t pt-2 text-base font-semibold">
              <span>{t("commercial.comptoir.total_ttc")}</span><span className="tabular-nums">{formatAr(totalHt + tva)}</span>
            </div>
            <p className="mt-1 text-right text-xs text-muted-foreground">{t("commercial.comptoir.estimation")}</p>
          </div>

          {erreur && (
            <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{erreur}</p>
          )}

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground"><Kbd>F9</Kbd> {t("commercial.comptoir.hint_f9")}</p>
            <Button size="lg" onClick={valider} disabled={creer.isPending} title={t("commercial.comptoir.generer_raccourci")}>
              {creer.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("commercial.comptoir.generer")}
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
