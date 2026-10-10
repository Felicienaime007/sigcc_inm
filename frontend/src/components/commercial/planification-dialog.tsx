"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { ClientSearch } from "@/components/clients/client-search";
import { Field } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { getErrorMessage } from "@/lib/errors";
import { useCrud } from "@/lib/resource";
import { useT } from "@/lib/i18n/contexte";
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
  const { t } = useT();
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
    if (!edition && !client) return setErreur(t("commercial.dialog_planif.err_client"));
    if (!periode.trim()) return setErreur(t("commercial.dialog_planif.err_periode"));
    const e = verifierLignes(lignes, false, t);
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
      title={edition ? t("commercial.dialog_planif.titre_modif") : t("commercial.dialog_planif.titre_nouveau")}
      description={t("commercial.dialog_planif.description")}
      onSubmit={(e) => { e?.preventDefault(); void envoyer(); }}
      submitting={crud.create.isPending || crud.update.isPending}
      error={erreur}
      wide
    >
      <Field label={t("commercial.dialog_planif.champ_client")}>
        {edition ? (
          <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm">{planification.nom_client}</div>
        ) : (
          <ClientSearch value={client} onChange={setClient} exclureTypes={["SIMPLE"]} />
        )}
      </Field>

      <Field label={t("commercial.dialog_planif.champ_periode")} htmlFor="periode" hint={t("commercial.dialog_planif.hint_periode")}>
        <Input id="periode" value={periode} onChange={(e) => setPeriode(e.target.value)} maxLength={50} />
      </Field>

      <Field label={t("commercial.dialog_planif.champ_produits")}>
        <LignesEditor lignes={lignes} onChange={setLignes} avecPrix={false} libelleQuantite={t("commercial.planifications.qte_estimee")} />
      </Field>
    </FormDialog>
  );
}
