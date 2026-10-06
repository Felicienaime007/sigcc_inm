"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Field } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { entierPositif } from "@/lib/commercial";
import { formatAr, formatNombre } from "@/lib/format";
import { useApiMutation } from "@/lib/resource";
import type { Avoir, Facture } from "@/types/commercial";

/** Création d'un avoir à partir d'une facture ; `deja` = quantités déjà retournées par produit. */
export function AvoirDialog({
  open, onOpenChange, facture, deja,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facture: Facture;
  deja: Record<number, number>;
}) {
  const [motif, setMotif] = useState("");
  const [quantites, setQuantites] = useState<Record<number, string>>({});
  const [erreur, setErreur] = useState<string | null>(null);

  const creer = useApiMutation(
    async (body: unknown) => (await api.post<Avoir>("/commercial/avoirs/", body)).data,
    { success: "Avoir créé.", silentError: true },
  );

  // Réinitialisation légitime à l'ouverture : nouveau brouillon à chaque fois.
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMotif("");
      setQuantites({});
      setErreur(null);
    }
  }, [open]);

  const maximum = (produit: number, facturee: number) => facturee - (deja[produit] ?? 0);

  async function envoyer() {
    setErreur(null);
    if (!motif.trim()) return setErreur("Le motif est obligatoire.");

    const lignes: { produit: number; quantite_retournee: number }[] = [];
    for (const l of facture.lignes) {
      const saisie = (quantites[l.produit] ?? "").trim();
      if (saisie === "" || saisie === "0") continue;
      const q = entierPositif(saisie);
      if (q === null) return setErreur(`${l.code_produit} : quantité invalide.`);
      const max = maximum(l.produit, l.quantite_facturee);
      if (q > max) return setErreur(`${l.code_produit} : maximum retournable ${max}.`);
      lignes.push({ produit: l.produit, quantite_retournee: q });
    }
    if (lignes.length === 0) return setErreur("Indiquez la quantité retournée d'au moins un produit.");

    try {
      await creer.mutateAsync({ facture: facture.id_facture, motif: motif.trim(), lignes });
      onOpenChange(false);
    } catch (e) {
      setErreur(getErrorMessage(e));
    }
  }

  const estimation = facture.lignes.reduce((somme, l) => {
    const q = entierPositif(quantites[l.produit] ?? "") ?? 0;
    return somme + q * Number(l.prix_unitaire);
  }, 0);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Avoir sur la facture ${facture.num_facture}`}
      description="Retour de marchandise ou correction. Montant calculé sur le prix facturé (HT)."
      onSubmit={(e) => {
        e?.preventDefault();
        void envoyer();
      }}
      submitting={creer.isPending}
      error={erreur}
      submitLabel="Créer l'avoir"
      wide
    >
      <Field label="Motif" htmlFor="motif">
        <Textarea id="motif" rows={2} value={motif} onChange={(e) => setMotif(e.target.value)} />
      </Field>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produit</TableHead>
              <TableHead className="text-right">Facturé</TableHead>
              <TableHead className="text-right">Déjà en avoir</TableHead>
              <TableHead className="w-28 text-right">À retourner</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {facture.lignes.map((l) => {
              const max = maximum(l.produit, l.quantite_facturee);
              return (
                <TableRow key={l.produit}>
                  <TableCell>
                    <p className="font-medium">{l.designation}</p>
                    <p className="text-xs text-muted-foreground">
                      {l.code_produit} · {formatAr(l.prix_unitaire)}
                    </p>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatNombre(l.quantite_facturee)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNombre(deja[l.produit] ?? 0)}</TableCell>
                  <TableCell className="text-right">
                    <Input
                      inputMode="numeric"
                      className="text-right"
                      disabled={max <= 0}
                      placeholder={max <= 0 ? "—" : `0 – ${max}`}
                      value={quantites[l.produit] ?? ""}
                      onChange={(e) => setQuantites((q) => ({ ...q, [l.produit]: e.target.value }))}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <p className="text-right text-sm">
        Montant de l&apos;avoir (HT) : <span className="font-semibold tabular-nums">{formatAr(estimation)}</span>
      </p>
    </FormDialog>
  );
}