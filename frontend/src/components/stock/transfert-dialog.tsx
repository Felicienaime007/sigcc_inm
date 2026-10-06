"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { entierPositif } from "@/lib/commercial";
import { getErrorMessage } from "@/lib/errors";
import { formatNombre } from "@/lib/format";
import { useApiMutation, useOptions } from "@/lib/resource";
import { libelleEmplacement } from "@/lib/stock";
import type { EmplacementStock, LigneStock, ProduitRef } from "@/types/stock";
import { ProduitFige, ProduitSelect } from "./selects";

/** Transfert d'un produit entre deux emplacements. */
export function TransfertDialog({ produit, onClose }: { produit?: ProduitRef | null; onClose: () => void }) {
  const { can } = useAuth();
  const [produitId, setProduitId] = useState<number | null>(produit?.id_produit ?? null);
  const [source, setSource] = useState<number | null>(null);
  const [destination, setDestination] = useState<number | null>(null);
  const [quantite, setQuantite] = useState("");
  const [motif, setMotif] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  const lignes = useOptions<LigneStock>("stock/lignes", { produit: produitId }, produitId !== null);
  const sources = (lignes.data ?? []).filter((l) => l.quantite_disponible > 0);
  const ligneSource = sources.find((l) => l.emplacement === source);

  const emplacements = useOptions<EmplacementStock>("stock/emplacements", {}, can("emplacement.view"));
  const destinations = (emplacements.data ?? []).filter((e) => e.id_emplacement !== source);

  const transferer = useApiMutation(
    async (body: unknown) => (await api.post("/stock/lignes/transferer/", body)).data,
    { success: "Transfert effectué.", silentError: true },
  );

  async function envoyer() {
    setErreur(null);
    if (produitId === null) return setErreur("Choisissez le produit.");
    if (source === null) return setErreur("Choisissez l'emplacement source.");
    if (destination === null) return setErreur("Choisissez l'emplacement de destination.");
    if (source === destination) return setErreur("La source et la destination doivent être différentes.");
    const q = entierPositif(quantite);
    if (q === null) return setErreur("La quantité doit être un entier supérieur à 0.");
    if (ligneSource && q > ligneSource.quantite_disponible) {
      return setErreur(`Quantité supérieure au stock libre à la source (${formatNombre(ligneSource.quantite_disponible)}).`);
    }
    try {
      await transferer.mutateAsync({
        produit: produitId, source, destination, quantite: q,
        ...(motif.trim() ? { motif: motif.trim() } : {}),
      });
      onClose();
    } catch (e) {
      setErreur(getErrorMessage(e));
    }
  }

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Transférer du stock"
      description="Déplacement entre deux emplacements. Seul le stock libre (non réservé) peut être transféré."
      onSubmit={(e) => { e?.preventDefault(); void envoyer(); }}
      submitting={transferer.isPending}
      error={erreur}
      submitLabel="Transférer"
    >
      <Field label="Produit">
        {produit ? (
          <ProduitFige produit={produit} />
        ) : (
          <ProduitSelect value={produitId} onChange={(id) => { setProduitId(id); setSource(null); }} />
        )}
      </Field>

      <Field label="De l'emplacement">
        <Select
          value={source !== null ? String(source) : ""}
          onValueChange={(v) => setSource(Number(v))}
          disabled={produitId === null || lignes.isLoading}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={produitId === null ? "Choisissez d'abord le produit…" : "Choisir la source…"} />
          </SelectTrigger>
          <SelectContent>
            {sources.map((l) => (
              <SelectItem key={l.emplacement} value={String(l.emplacement)}>
                {libelleEmplacement(l)} — libre {formatNombre(l.quantite_disponible)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {produitId !== null && !lignes.isLoading && sources.length === 0 && (
          <p className="mt-1 text-xs text-amber-700">Aucun stock libre pour ce produit (tout est réservé ou en rupture).</p>
        )}
      </Field>

      <Field label="Vers l'emplacement">
        <Select
          value={destination !== null ? String(destination) : ""}
          onValueChange={(v) => setDestination(Number(v))}
          disabled={source === null || emplacements.isLoading}
        >
          <SelectTrigger className="w-full"><SelectValue placeholder="Choisir la destination…" /></SelectTrigger>
          <SelectContent>
            {destinations.map((e) => (
              <SelectItem key={e.id_emplacement} value={String(e.id_emplacement)}>{libelleEmplacement(e)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <Field label="Quantité" htmlFor="quantite">
          <Input id="quantite" inputMode="numeric" className="text-right" value={quantite}
            onChange={(e) => setQuantite(e.target.value)} />
        </Field>
        <Field label="Motif (facultatif)" htmlFor="motif">
          <Input id="motif" maxLength={100} value={motif} onChange={(e) => setMotif(e.target.value)} />
        </Field>
      </div>
    </FormDialog>
  );
}