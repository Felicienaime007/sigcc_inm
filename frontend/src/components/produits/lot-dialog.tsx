"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { entierPositif } from "@/lib/commercial";
import { getErrorMessage } from "@/lib/errors";
import { formatNombre } from "@/lib/format";
import { MAX_LOT, formatPlage } from "@/lib/produits";
import { useApiMutation, useOptions } from "@/lib/resource";
import type { Preparation } from "@/types/commercial";
import type { Lot, ProduitCatalogue } from "@/types/produits";

const AUCUNE = "__aucune__";

/** Lancement d'un lot de production : le serveur calcule la plage de numéros. */
export function LotDialog({ onClose }: { onClose: () => void }) {
  const { can } = useAuth();
  const produits = useOptions<ProduitCatalogue>("produits", { en_serie: "true" });

  const [produitId, setProduitId] = useState<number | null>(null);
  const [quantite, setQuantite] = useState("");
  const [prepId, setPrepId] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const produit = produits.data?.find((p) => p.id_produit === produitId);

  // Préparations en cours qui contiennent ce produit
  const preparations = useOptions<Preparation>(
    "commercial/preparations", { statut: "EN_COURS" }, can("preparation.view") && produitId !== null,
  );
  const dispo = (preparations.data ?? []).filter((p) => p.lignes.some((l) => l.produit === produitId));

  const creer = useApiMutation(
    async (body: unknown) => (await api.post<Lot>("/produits/lots/", body)).data,
    { silentError: true },
  );

  const q = entierPositif(quantite);
  const dernier = produit?.dernier_numero_valide ?? 0;

  async function envoyer() {
    setErreur(null);
    if (!produit) return setErreur("Choisissez le produit.");
    if (q === null) return setErreur("La quantité doit être un entier supérieur à 0.");
    if (q > MAX_LOT) return setErreur(`Quantité trop élevée (maximum ${formatNombre(MAX_LOT)} par lot).`);
    try {
      const lot = await creer.mutateAsync({
        produit: produit.id_produit,
        quantite_lancee: q,
        ...(prepId !== null ? { preparation: prepId } : {}),
      });
      toast.success(`Lot ${lot.num_lot} lancé : ${formatPlage(lot.prefixe_serie, lot.num_debut, lot.num_fin)}`);
      onClose();
    } catch (e) {
      setErreur(getErrorMessage(e));
    }
  }

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Lancer un lot de production"
      description="Les numéros sont attribués automatiquement par le serveur, à la suite du dernier numéro de la série."
      onSubmit={(e) => { e?.preventDefault(); void envoyer(); }}
      submitting={creer.isPending}
      error={erreur}
      submitLabel="Lancer le lot"
    >
      <Field label="Produit numéroté en série">
        <Select
          value={produitId !== null ? String(produitId) : ""}
          onValueChange={(v) => { setProduitId(Number(v)); setPrepId(null); }}
          disabled={produits.isLoading}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={produits.isLoading ? "Chargement…" : "Choisir le produit…"} />
          </SelectTrigger>
          <SelectContent>
            {(produits.data ?? []).map((p) => (
              <SelectItem key={p.id_produit} value={String(p.id_produit)}>
                {p.code_produit} — {p.designation}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!produits.isLoading && (produits.data?.length ?? 0) === 0 && (
          <p className="mt-1 text-xs text-amber-700">
            Aucun produit numéroté en série : créez une série puis associez-la à un produit (menu « Produits »).
          </p>
        )}
      </Field>

      <Field label="Quantité à imprimer" htmlFor="quantite" hint={`Maximum ${formatNombre(MAX_LOT)} par lot.`}>
        <Input id="quantite" inputMode="numeric" className="text-right" value={quantite}
          onChange={(e) => setQuantite(e.target.value)} />
      </Field>

      {produit && q !== null && q <= MAX_LOT && (
        <p className="rounded-md bg-muted/40 p-3 text-sm">
          Numéros prévus :{" "}
          <span className="font-semibold tabular-nums">{formatPlage(produit.prefixe_courant, dernier + 1, dernier + q)}</span>
          <span className="block text-xs text-muted-foreground">
            Calculés sur le dernier numéro connu ({dernier}) ; la plage définitive est confirmée à la création.
          </span>
        </p>
      )}

      {produit && can("preparation.view") && (
        <Field label="Préparation de commande (facultatif)" hint="Rattache le lot à la commande à servir : la préparation ne pourra être terminée qu'une fois le lot terminé.">
          <Select
            value={prepId !== null ? String(prepId) : AUCUNE}
            onValueChange={(v) => {
              const id = v === AUCUNE ? null : Number(v);
              setPrepId(id);
              const ligne = dispo.find((p) => p.id_preparation === id)?.lignes.find((l) => l.produit === produitId);
              if (ligne && quantite.trim() === "") setQuantite(String(ligne.quantite_preparee));
            }}
          >
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={AUCUNE}>— Aucune (réapprovisionnement du stock) —</SelectItem>
              {dispo.map((p) => (
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