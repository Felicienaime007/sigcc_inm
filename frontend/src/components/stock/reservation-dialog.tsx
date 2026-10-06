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
import type { Preparation } from "@/types/commercial";
import type { LigneStock, ProduitRef } from "@/types/stock";
import { ProduitFige, ProduitSelect } from "./selects";

const AUCUNE = "__aucune__";

/** Réservation manuelle de stock, rattachée ou non à une préparation de commande. */
export function ReservationDialog({ produit, onClose }: { produit?: ProduitRef | null; onClose: () => void }) {
  const { can } = useAuth();
  const [produitId, setProduitId] = useState<number | null>(produit?.id_produit ?? null);
  const [quantite, setQuantite] = useState("");
  const [limite, setLimite] = useState("");
  const [prepId, setPrepId] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const voirStock = can("stock.view") && produitId !== null;
  const lignes = useOptions<LigneStock>("stock/lignes", { produit: produitId }, voirStock);
  const dispo = (lignes.data ?? []).reduce((s, l) => s + l.quantite_disponible, 0);
  const connu = voirStock && !lignes.isLoading;

  const preparations = useOptions<Preparation>(
    "commercial/preparations", { statut: "EN_COURS" }, can("preparation.view") && produitId !== null,
  );
  const dispoPreps = (preparations.data ?? []).filter((p) => p.lignes.some((l) => l.produit === produitId));

  const creer = useApiMutation(
    async (body: unknown) => (await api.post("/stock/reservations/", body)).data,
    { success: "Stock réservé.", silentError: true },
  );

  // Valeur minimale du champ date/heure (heure locale du navigateur)
  const minLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  async function envoyer() {
    setErreur(null);
    if (produitId === null) return setErreur("Choisissez le produit.");
    const q = entierPositif(quantite);
    if (q === null) return setErreur("La quantité doit être un entier supérieur à 0.");
    if (connu && q > dispo) return setErreur(`Quantité supérieure au stock disponible (${formatNombre(dispo)}).`);
    if (limite && new Date(limite) <= new Date()) return setErreur("La date limite doit être dans le futur.");

    try {
      await creer.mutateAsync({
        produit: produitId,
        quantite_bloquee: q,
        ...(limite ? { date_limite: new Date(limite).toISOString() } : {}),
        ...(prepId !== null ? { preparation: prepId } : {}),
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
      title="Réserver du stock"
      description="Bloque une quantité disponible. Une réservation sans préparation reste active jusqu'à sa libération ou son expiration."
      onSubmit={(e) => { e?.preventDefault(); void envoyer(); }}
      submitting={creer.isPending}
      error={erreur}
      submitLabel="Réserver"
    >
      <Field label="Produit">
        {produit ? (
          <ProduitFige produit={produit} />
        ) : (
          <ProduitSelect value={produitId} onChange={(id) => { setProduitId(id); setPrepId(null); }} />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Quantité à réserver" htmlFor="quantite"
          hint={connu ? `Disponible : ${formatNombre(dispo)}` : undefined}
        >
          <Input id="quantite" inputMode="numeric" className="text-right" value={quantite}
            onChange={(e) => setQuantite(e.target.value)} />
        </Field>
        <Field label="Date limite (facultatif)" htmlFor="limite" hint="Par défaut : 7 jours.">
          <Input id="limite" type="datetime-local" min={minLocal} value={limite}
            onChange={(e) => setLimite(e.target.value)} />
        </Field>
      </div>

      {produitId !== null && can("preparation.view") && (
        <Field label="Préparation de commande (facultatif)" hint="Rattache la réservation à la commande qui sera livrée.">
          <Select
            value={prepId !== null ? String(prepId) : AUCUNE}
            onValueChange={(v) => {
              const id = v === AUCUNE ? null : Number(v);
              setPrepId(id);
              const ligne = dispoPreps.find((p) => p.id_preparation === id)?.lignes.find((l) => l.produit === produitId);
              if (ligne && quantite.trim() === "") setQuantite(String(ligne.quantite_preparee));
            }}
          >
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={AUCUNE}>— Aucune —</SelectItem>
              {dispoPreps.map((p) => (
                <SelectItem key={p.id_preparation} value={String(p.id_preparation)}>
                  {p.num_commande} — {p.nom_client}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
    </FormDialog>
  );
}