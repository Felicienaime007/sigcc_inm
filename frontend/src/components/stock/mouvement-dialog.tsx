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
import { useT } from "@/lib/i18n/contexte";
import { formatNombre } from "@/lib/format";
import { useApiMutation, useList } from "@/lib/resource";
import { TYPES_SAISIE } from "@/lib/stock";
import type { LigneStock, ProduitRef } from "@/types/stock";
import { EmplacementSelect, ProduitFige, ProduitSelect } from "./selects";

/** Mouvement manuel : stock initial, ajustement en entrée ou sortie (casse, perte). */
export function MouvementDialog({ produit, onClose }: { produit?: ProduitRef | null; onClose: () => void }) {
  const { can } = useAuth();
  const { t } = useT();
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
    { success: t("stock.dialog_mouvement.success"), silentError: true },
  );

  async function envoyer() {
    setErreur(null);
    if (produitId === null) return setErreur(t("stock.dialog_mouvement.err_produit"));
    if (emplacement === null) return setErreur(t("stock.dialog_mouvement.err_emplacement"));
    const q = entierPositif(quantite);
    if (q === null) return setErreur(t("stock.dialog_mouvement.err_qte"));
    if (sortie && connu && q > libre) {
      return setErreur(t("stock.dialog_mouvement.err_qte_stock", { libre: formatNombre(libre) }));
    }
    const ref = reference.trim();
    if (!ref) return setErreur(t("stock.dialog_mouvement.err_motif_obligatoire"));
    if (ref.length > 100) return setErreur(t("stock.dialog_mouvement.err_motif_max"));

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
      title={t("stock.dialog_mouvement.titre")}
      description={t("stock.dialog_mouvement.description")}
      onSubmit={(e) => { e?.preventDefault(); void envoyer(); }}
      submitting={creer.isPending}
      error={erreur}
      submitLabel={t("stock.dialog_mouvement.submit")}
    >
      <Field label={t("stock.dialog_mouvement.champ_type")}>
        <Select
          value={type}
          onValueChange={(v) => setType(v ?? "")}
          items={Object.fromEntries(TYPES_SAISIE.map((o) => [o.value, t(`stock.dialog_mouvement.types.${o.value}`)]))}
        >
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TYPES_SAISIE.map((o) => <SelectItem key={o.value} value={o.value}>{t(`stock.dialog_mouvement.types.${o.value}`)}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>

      <Field label={t("stock.dialog_mouvement.champ_produit")}>
        {produit ? <ProduitFige produit={produit} /> : <ProduitSelect value={produitId} onChange={setProduitId} />}
      </Field>

      <Field label={t("stock.dialog_mouvement.champ_emplacement")}>
        <EmplacementSelect value={emplacement} onChange={setEmplacement} />
        {sortie && connu && (
          <p className="mt-1 text-xs text-muted-foreground">
            {t("stock.dialog_mouvement.hint_stock_libre")} <span className="font-medium text-foreground">{formatNombre(libre)}</span>
          </p>
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <Field label={t("stock.dialog_mouvement.champ_quantite")} htmlFor="quantite">
          <Input id="quantite" inputMode="numeric" className="text-right" value={quantite}
            onChange={(e) => setQuantite(e.target.value)} />
        </Field>
        <Field
          label={t("stock.dialog_mouvement.champ_motif")} htmlFor="reference"
          hint={sortie ? t("stock.dialog_mouvement.hint_motif_sortie") : t("stock.dialog_mouvement.hint_motif_entree")}
        >
          <Input id="reference" maxLength={100} value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
      </div>
    </FormDialog>
  );
}
