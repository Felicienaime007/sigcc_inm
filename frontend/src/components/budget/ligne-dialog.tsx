"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { RemoteSelect } from "@/components/data/remote-select";
import { Field } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { versNombre } from "@/lib/clients";
import { applyServerErrors } from "@/lib/form-utils";
import { useCrud } from "@/lib/resource";
import type { Budget, LigneBudget, TypeFinancement } from "@/types/budget";

const schema = z.object({
  code_article: z.string().trim().min(1, "Le code article est obligatoire.").max(50, "50 caractères maximum."),
  libelle_ligne: z.string().trim().min(1, "Le libellé est obligatoire.").max(255, "255 caractères maximum."),
  montant: z.string().refine(
    (s) => s.trim() !== "" && Number.isFinite(versNombre(s)) && versNombre(s) >= 0,
    "Le montant doit être positif ou nul.",
  ),
  type_financement: z.number().nullable(),
});
type FormValues = z.infer<typeof schema>;

/** Création (ligne = null) ou modification d'une ligne budgétaire du budget `budget`. */
export function LigneDialog({
  budget, ligne, onClose,
}: {
  budget: Budget;
  ligne: LigneBudget | null;
  onClose: () => void;
}) {
  const crud = useCrud<LigneBudget, Record<string, unknown>>("budget/lignes");
  const [erreurServeur, setErreurServeur] = useState<string | null>(null);
  const verrouille = (ligne?.nb_engagements ?? 0) > 0;   // le solde évolue par les engagements seuls

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      code_article: ligne?.code_article ?? "",
      libelle_ligne: ligne?.libelle_ligne ?? "",
      montant: ligne ? String(Number(ligne.montant_disponible)) : "",
      type_financement: ligne?.type_financement ?? null,
    },
  });

  const enregistrer = form.handleSubmit(async (v) => {
    setErreurServeur(null);
    const montant = Math.round(versNombre(v.montant) * 100) / 100;
    try {
      if (ligne) {
        await crud.update.mutateAsync({
          id: ligne.id_ligne_budget,
          body: {
            code_article: v.code_article, libelle_ligne: v.libelle_ligne,
            type_financement: v.type_financement,
            // le solde n'est envoyé que s'il est modifiable
            ...(verrouille ? {} : { montant_disponible: montant }),
          },
        });
      } else {
        await crud.create.mutateAsync({
          budget: budget.id_budget, code_article: v.code_article, libelle_ligne: v.libelle_ligne,
          montant_disponible: montant, type_financement: v.type_financement,
        });
      }
      onClose();
    } catch (e) {
      setErreurServeur(
        applyServerErrors(e, form.setError, ["code_article", "libelle_ligne", "montant", "type_financement"], {
          montant_disponible: "montant",
        }),
      );
    }
  });

  const erreurs = form.formState.errors;

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={ligne ? "Modifier la ligne budgétaire" : "Nouvelle ligne budgétaire"}
      description={`Budget ${budget.annee_budgetaire} — ${budget.nom_organisme}`}
      onSubmit={enregistrer}
      submitting={form.formState.isSubmitting}
      error={erreurServeur}
    >
      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <Field label="Code article" htmlFor="code_article" error={erreurs.code_article?.message}>
          <Input id="code_article" autoFocus {...form.register("code_article")} />
        </Field>
        <Field label="Libellé" htmlFor="libelle_ligne" error={erreurs.libelle_ligne?.message}>
          <Input id="libelle_ligne" {...form.register("libelle_ligne")} />
        </Field>
      </div>

      <Field
        label={ligne ? "Montant disponible (Ar)" : "Dotation de la ligne (Ar)"}
        htmlFor="montant"
        error={erreurs.montant?.message}
        hint={
          verrouille
            ? "Non modifiable : des engagements existent. Le solde évolue par les engagements et leurs annulations."
            : "Crédit ouvert sur cette ligne. Il diminue à chaque engagement visé."
        }
      >
        <Input id="montant" inputMode="decimal" disabled={verrouille} {...form.register("montant")} />
      </Field>

      <Field label="Type de financement (facultatif)" error={erreurs.type_financement?.message}>
        <Controller
          control={form.control}
          name="type_financement"
          render={({ field }) => (
            <RemoteSelect<TypeFinancement>
              path="budget/types-financement"
              value={field.value}
              onChange={field.onChange}
              getValue={(t) => t.id_type_financement}
              getLabel={(t) => t.libelle_financement}
              placeholder="Choisir…"
              allowEmpty
              emptyLabel="— Non précisé —"
            />
          )}
        />
      </Field>
    </FormDialog>
  );
}