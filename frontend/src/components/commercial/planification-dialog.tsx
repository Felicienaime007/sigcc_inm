"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { ClientSearch } from "@/components/clients/client-search";
import { Field } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { getErrorMessage } from "@/lib/errors";
import { useCrud } from "@/lib/resource";
import type { Client } from "@/types/clients";
import type { Planification } from "@/types/commercial";
import { LignesEditor, verifierLignes, versApi, type LigneEdit } from "./lignes-editor";

/** Création (planification = null) ou modification d'une planification de besoins. */
export function PlanificationDialog({
  planification, onClose,
}: {
  planification: Planification | null;
  onClose: () => void;
}) {
  const edition = planification !== null;
  const crud = useCrud<Planification, Record<string, unknown>>("commercial/planifications");

  const [client, setClient] = useState<Client | null>(null);
  const [periode, setPeriode] = useState(planification?.periode_cible ?? "");
  const [lignes, setLignes] = useState<LigneEdit[]>(
    planification?.lignes.map((l) => ({
      produit: { id_produit: l.produit, code_produit: l.code_produit, designation: l.designation, prix_tarif: "0" },
      quantite: String(l.quantite_estimee),
      prix: "0",
    })) ?? [],
  );
  const [erreur, setErreur] = useState<string | null>(null);

  async function envoyer() {
    setErreur(null);
    if (!edition && !client) return setErreur("Sélectionnez le client.");
    if (!periode.trim()) return setErreur("La période cible est obligatoire (ex. 2026-T4).");
    const e = verifierLignes(lignes, false);
    if (e) return setErreur(e);

    const body = {
      periode_cible: periode.trim(),
      lignes: versApi(lignes, "quantite_estimee"),
    };
    try {
      if (edition) await crud.update.mutateAsync({ id: planification.id_planification, body });
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
      title={edition ? "Modifier la planification" : "Nouvelle planification de besoins"}
      description="Besoins prévus d'un client sur une période. Une seule planification par client et par période."
      onSubmit={(e) => { e?.preventDefault(); void envoyer(); }}
      submitting={crud.create.isPending || crud.update.isPending}
      error={erreur}
      wide
    >
      <Field label="Client">
        {edition ? (
          <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm">{planification.nom_client}</div>
        ) : (
          <ClientSearch value={client} onChange={setClient} exclureTypes={["SIMPLE"]} />
        )}
      </Field>

      <Field label="Période cible" htmlFor="periode" hint="Ex. 2026-T4 (trimestre) ou 2026-S2 (semestre).">
        <Input id="periode" value={periode} onChange={(e) => setPeriode(e.target.value)} maxLength={50} />
      </Field>

      <Field label="Produits prévus">
        <LignesEditor lignes={lignes} onChange={setLignes} avecPrix={false} libelleQuantite="Quantité estimée" />
      </Field>
    </FormDialog>
  );
}