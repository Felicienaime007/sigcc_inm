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
import { useApiMutation, useList } from "@/lib/resource";
import { TYPES_SAISIE } from "@/lib/stock";
import type { LigneStock, ProduitRef } from "@/types/stock";
import { EmplacementSelect, ProduitFige, ProduitSelect } from "./selects";

/** Mouvement manuel : stock initial, ajustement en entrée ou sortie (casse, perte). */
export function MouvementDialog({ produit, onClose }: { produit?: ProduitRef | null; onClose: () => void }) {
  const { can } = useAuth();
  const [type, setType] = useState("ENTREE_INITIAL");
  const [produitId, setProduitId] = useState<number | null>(produit?.id_produit ?? null);
  const [emplacement, setEmplacement] = useState<number | null>(null);
  const [quantite, setQuantite] = useState("");
  const [reference, setReference] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  const sortie = type.startsWith("SORTIE");
  const peutVoir = can("stock.view") && produitId !== null && emplacement !== null;
  const ligne = useList<LigneStock>("stock/lignes", { produit: produitId, emplacement, page_size: 1 }, peutVoir);
  const libre = ligne.data?.results[0]?.quantite_disponible ?? 0;
  const connu = peutVoir && !ligne.isLoading;

  const creer = useApiMutation(
    async (body: unknown) => (await api.post("/stock/mouvements/", body)).data,
    { success: "Mouvement enregistré.", silentError: true },
  );

  async function envoyer() {
    setErreur(null);
    if (produitId === null) return setErreur("Choisissez le produit.");
    if (emplacement === null) return setErreur("Choisissez l'emplacement.");
    const q = entierPositif(quantite);
    if (q === null) return setErreur("La quantité doit être un entier supérieur à 0.");
    if (sortie && connu && q > libre) {
      return setErreur(`Quantité supérieure au stock libre à cet emplacement (${formatNombre(libre)}).`);
    }
    const ref = reference.trim();
    if (!ref) return setErreur("Le motif est obligatoire.");
    if (ref.length > 100) return setErreur("Le motif est limité à 100 caractères.");

    try {
      await creer.mutateAsync({
        type_mouvement: type, quantite_mouv: q, produit: produitId, emplacement, reference: ref,
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
      title="Mouvement de stock manuel"
      description="Les entrées de production, les retours sur avoir, les livraisons et les transferts sont enregistrés automatiquement."
      onSubmit={(e) => { e?.preventDefault(); void envoyer(); }}
      submitting={creer.isPending}
      error={erreur}
      submitLabel="Enregistrer le mouvement"
    >
      <Field label="Type de mouvement">
        <Select value={type} onValueChange={(v) => setType(v ?? "")}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TYPES_SAISIE.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Produit">
        {produit ? <ProduitFige produit={produit} /> : <ProduitSelect value={produitId} onChange={setProduitId} />}
      </Field>

      <Field label="Emplacement">
        <EmplacementSelect value={emplacement} onChange={setEmplacement} />
        {sortie && connu && (
          <p className="mt-1 text-xs text-muted-foreground">
            Stock libre à cet emplacement : <span className="font-medium text-foreground">{formatNombre(libre)}</span>
          </p>
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <Field label="Quantité" htmlFor="quantite">
          <Input id="quantite" inputMode="numeric" className="text-right" value={quantite}
            onChange={(e) => setQuantite(e.target.value)} />
        </Field>
        <Field
          label="Motif / référence" htmlFor="reference"
          hint={sortie ? "Ex. « Casse constatée le 12/03 »." : "Ex. « Inventaire initial 2026 »."}
        >
          <Input id="reference" maxLength={100} value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
      </div>
    </FormDialog>
  );
}