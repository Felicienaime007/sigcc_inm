"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { versNombre } from "@/lib/clients";
import { entierPositif } from "@/lib/commercial";
import { formatAr } from "@/lib/format";
import { useOptions } from "@/lib/resource";

export interface ProduitLight {
  id_produit: number;
  code_produit: string;
  designation: string;
  prix_tarif: string;
}

/** Ligne en cours de saisie : quantité et prix restent du texte jusqu'à l'envoi. */
export interface LigneEdit {
  produit: ProduitLight;
  quantite: string;
  prix: string;
}

const prixNombre = (l: LigneEdit) => {
  const p = versNombre(l.prix);
  return Number.isFinite(p) ? p : 0;
};

export const totalEdition = (lignes: LigneEdit[]) =>
  lignes.reduce((s, l) => s + (entierPositif(l.quantite) ?? 0) * prixNombre(l), 0);

export function verifierLignes(lignes: LigneEdit[], avecPrix: boolean): string | null {
  if (lignes.length === 0) return "Ajoutez au moins un produit.";
  for (const l of lignes) {
    if (entierPositif(l.quantite) === null) return `${l.produit.code_produit} : la quantité doit être un entier supérieur à 0.`;
    if (avecPrix) {
      const p = versNombre(l.prix);
      if (!Number.isFinite(p) || p < 0) return `${l.produit.code_produit} : prix invalide.`;
    }
  }
  return null;
}

/** Lignes prêtes pour l'API : versApi(lignes, "quantite", "prix_unitaire_devis"). */
export function versApi(lignes: LigneEdit[], champQte: string, champPrix?: string) {
  return lignes.map((l) => ({
    produit: l.produit.id_produit,
    [champQte]: entierPositif(l.quantite),
    ...(champPrix ? { [champPrix]: Math.round(prixNombre(l) * 100) / 100 } : {}),
  }));
}

export function LignesEditor({
  lignes, onChange, avecPrix, libelleQuantite = "Quantité",
}: {
  lignes: LigneEdit[];
  onChange: (lignes: LigneEdit[]) => void;
  avecPrix: boolean;
  libelleQuantite?: string;
}) {
  const { data: produits } = useOptions<ProduitLight>("produits");
  const [produitId, setProduitId] = useState("");
  const [quantite, setQuantite] = useState("1");
  const [erreur, setErreur] = useState<string | null>(null);

  function ajouter() {
    setErreur(null);
    const produit = produits?.find((p) => String(p.id_produit) === produitId);
    if (!produit) return setErreur("Choisissez un produit.");
    const q = entierPositif(quantite);
    if (q === null) return setErreur("La quantité doit être un entier supérieur à 0.");

    const existante = lignes.find((l) => l.produit.id_produit === produit.id_produit);
    onChange(
      existante
        ? lignes.map((l) =>
            l === existante ? { ...l, quantite: String((entierPositif(l.quantite) ?? 0) + q) } : l,
          )
        : [...lignes, { produit, quantite: String(q), prix: String(Number(produit.prix_tarif)) }],
    );
    setProduitId("");
    setQuantite("1");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-60 flex-1">
          <p className="mb-1.5 text-xs text-muted-foreground">Produit</p>
          <Select value={produitId} onValueChange={(v) => setProduitId(v ?? "")}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Choisir un produit…" /></SelectTrigger>
            <SelectContent>
              {produits?.map((p) => (
                <SelectItem key={p.id_produit} value={String(p.id_produit)}>
                  {p.code_produit} — {p.designation} ({formatAr(p.prix_tarif)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-28">
          <p className="mb-1.5 text-xs text-muted-foreground">{libelleQuantite}</p>
          <Input
            inputMode="numeric" className="text-right" value={quantite}
            onChange={(e) => setQuantite(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); ajouter(); } }}
          />
        </div>
        <Button type="button" onClick={ajouter}>
          <Plus className="mr-2 h-4 w-4" /> Ajouter
        </Button>
      </div>
      {erreur && <p className="text-sm text-destructive">{erreur}</p>}

      {lignes.length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produit</TableHead>
                <TableHead className="w-28 text-right">{libelleQuantite}</TableHead>
                {avecPrix && <TableHead className="w-36 text-right">Prix unitaire</TableHead>}
                {avecPrix && <TableHead className="text-right">Montant HT</TableHead>}
                <TableHead className="w-px" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lignes.map((l) => (
                <TableRow key={l.produit.id_produit}>
                  <TableCell>
                    <p className="font-medium">{l.produit.designation}</p>
                    <p className="text-xs text-muted-foreground">{l.produit.code_produit}</p>
                  </TableCell>
                  <TableCell>
                    <Input
                      inputMode="numeric" className="text-right" value={l.quantite}
                      aria-invalid={entierPositif(l.quantite) === null}
                      onChange={(e) => onChange(lignes.map((x) => (x === l ? { ...x, quantite: e.target.value } : x)))}
                    />
                  </TableCell>
                  {avecPrix && (
                    <TableCell>
                      <Input
                        inputMode="decimal" className="text-right" value={l.prix}
                        aria-invalid={!Number.isFinite(versNombre(l.prix))}
                        onChange={(e) => onChange(lignes.map((x) => (x === l ? { ...x, prix: e.target.value } : x)))}
                      />
                    </TableCell>
                  )}
                  {avecPrix && (
                    <TableCell className="text-right tabular-nums">
                      {formatAr((entierPositif(l.quantite) ?? 0) * prixNombre(l))}
                    </TableCell>
                  )}
                  <TableCell>
                    <Button type="button" variant="ghost" size="icon" title="Retirer"
                      onClick={() => onChange(lignes.filter((x) => x !== l))}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {avecPrix && lignes.length > 0 && (
        <p className="text-right text-sm">
          Total HT : <span className="font-semibold tabular-nums">{formatAr(totalEdition(lignes))}</span>
        </p>
      )}
    </div>
  );
}