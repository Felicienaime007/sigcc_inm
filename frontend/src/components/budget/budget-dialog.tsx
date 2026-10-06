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
import { anneeCourante } from "@/lib/dates";
import { applyServerErrors } from "@/lib/form-utils";
import { useCrud } from "@/lib/resource";
import type { Organisme } from "@/types/clients";
import type { Budget } from "@/types/budget";

const schema = z
  .object({
    organisme: z.number().nullable(),
    annee: z.string().refine(
      (s) => /^\d{4}$/.test(s.trim()) && Number(s) >= 2000 && Number(s) <= 2100,
      "Année comprise entre 2000 et 2100.",
    ),
    montant: z.string().refine(
      (s) => s.trim() !== "" && Number.isFinite(versNombre(s)) && versNombre(s) >= 0,
      "Le montant doit être positif ou nul.",
    ),
  })
  .superRefine((v, ctx) => {
    if (v.organisme === null) {
      ctx.addIssue({ code: "custom", path: ["organisme"], message: "L'organisme est obligatoire." });
    }
  });
type FormValues = z.infer<typeof schema>;

/** Création (budget = null) ou modification d'un budget annuel d'organisme. */
export function BudgetDialog({ budget, onClose }: { budget: Budget | null; onClose: () => void }) {
  const crud = useCrud<Budget, Record<string, unknown>>("budget/budgets");
  const [erreurServeur, setErreurServeur] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      organisme: budget?.organisme ?? null,
      annee: String(budget?.annee_budgetaire ?? anneeCourante()),
      montant: budget ? String(Number(budget.montant_alloue)) : "",
    },
  });

  const aDesLignes = (budget?.nb_lignes ?? 0) > 0;

  const enregistrer = form.handleSubmit(async (v) => {
    setErreurServeur(null);
    const body = {
      organisme: v.organisme,
      annee_budgetaire: Number(v.annee),
      montant_alloue: Math.round(versNombre(v.montant) * 100) / 100,
    };
    try {
      if (budget) await crud.update.mutateAsync({ id: budget.id_budget, body });
      else await crud.create.mutateAsync(body);
      onClose();
    } catch (e) {
      setErreurServeur(
        applyServerErrors(e, form.setError, ["organisme", "annee", "montant"], {
          annee_budgetaire: "annee", montant_alloue: "montant",
        }),
      );
    }
  });

  const erreurs = form.formState.errors;

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={budget ? "Modifier le budget" : "Nouveau budget"}
      description="Un seul budget par organisme et par année. Les lignes budgétaires se saisissent ensuite dans la fiche du budget."
      onSubmit={enregistrer}
      submitting={form.formState.isSubmitting}
      error={erreurServeur}
    >
      <Field
        label="Organisme" error={erreurs.organisme?.message}
        hint={aDesLignes ? "Non modifiable : le budget a déjà des lignes." : undefined}
      >
        <Controller
          control={form.control}
          name="organisme"
          render={({ field }) => (
            <RemoteSelect<Organisme>
              path="clients/organismes"
              value={field.value}
              onChange={field.onChange}
              getValue={(o) => o.id_organisme}
              getLabel={(o) => `${o.nom_organisme} (${o.code_institutionnel})`}
              placeholder="Choisir l'organisme…"
              disabled={aDesLignes}
            />
          )}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Année budgétaire" htmlFor="annee" error={erreurs.annee?.message}>
          <Input id="annee" inputMode="numeric" maxLength={4} {...form.register("annee")} />
        </Field>
        <Field label="Montant alloué (Ar)" htmlFor="montant" error={erreurs.montant?.message}>
          <Input id="montant" inputMode="decimal" {...form.register("montant")} />
        </Field>
      </div>
    </FormDialog>
  );
}