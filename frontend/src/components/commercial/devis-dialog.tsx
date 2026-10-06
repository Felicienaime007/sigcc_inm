"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { ClientSearch } from "@/components/clients/client-search";
import { Field } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { entierPositif } from "@/lib/commercial";
import { getErrorMessage } from "@/lib/errors";
import { useCrud } from "@/lib/resource";
import type { Client } from "@/types/clients";
import type { Devis } from "@/types/commercial";
import { LignesEditor, verifierLignes, versApi, type LigneEdit } from "./lignes-editor";

/** Création (devis = null) ou modification d'un devis proforma. */
export function DevisDialog({ devis, onClose }: { devis: Devis | null; onClose: () => void }) {
  const edition = devis !== null;
  const crud = useCrud<Devis, Record<string, unknown>>("commercial/devis");

  const [client, setClient] = useState<Client | null>(null);
  const [validite, setValidite] = useState(String(devis?.validite_jours ?? 30));
  const [lignes, setLignes] = useState<LigneEdit[]>(
    devis?.lignes.map((l) => ({
      produit: {
        id_produit: l.produit, code_produit: l.code_produit, designation: l.designation,
        prix_tarif: l.prix_unitaire_devis,
      },
      quantite: String(l.quantite),
      prix: String(Number(l.prix_unitaire_devis)),
    })) ?? [],
  );
  const [erreur, setErreur] = useState<string | null>(null);

  async function envoyer() {
    setErreur(null);
    if (!edition && !client) return setErreur("Sélectionnez le client.");
    const jours = entierPositif(validite);
    if (jours === null) return setErreur("La validité doit être d'au moins 1 jour.");
    const e = verifierLignes(lignes, true);
    if (e) return setErreur(e);

    const body = { validite_jours: jours, lignes: versApi(lignes, "quantite", "prix_unitaire_devis") };
    try {
      if (edition) await crud.update.mutateAsync({ id: devis.id_devis, body });
      else await crud.create.mutateAsync({ ...body, client: client!.id_client });
      onClose();
    } catch (err) {
      setErreur(getErrorMessage(err));
    }
  }

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={edition ? `Modifier le devis ${devis.num_devis}` : "Nouveau devis proforma"}
      description="Le numéro est attribué automatiquement. Un devis converti en commande n'est plus modifiable."
      onSubmit={(e) => { e?.preventDefault(); void envoyer(); }}
      submitting={crud.create.isPending || crud.update.isPending}
      error={erreur}
      wide
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
        <Field label="Client">
          {edition ? (
            <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm">{devis.nom_client}</div>
          ) : (
            <ClientSearch value={client} onChange={setClient} exclureTypes={["SIMPLE"]} />
          )}
        </Field>
        <Field label="Validité (jours)" htmlFor="validite">
          <Input id="validite" inputMode="numeric" className="text-right" value={validite}
            onChange={(e) => setValidite(e.target.value)} />
        </Field>
      </div>

      <Field label="Lignes du devis" hint="Le prix est celui du catalogue ; il peut être modifié pour ce devis.">
        <LignesEditor lignes={lignes} onChange={setLignes} avecPrix />
      </Field>
    </FormDialog>
  );
}