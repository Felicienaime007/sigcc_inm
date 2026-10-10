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
import { useT } from "@/lib/i18n/contexte";
import { useCrud } from "@/lib/resource";
import type { Organisme } from "@/types/clients";
import type { Budget } from "@/types/budget";

const schemaTraduction = (t: (c: string) => string) =>
  z
    .object({
      organisme: z.number().nullable(),
      annee: z.string().refine(
        (s) => /^\d{4}$/.test(s.trim()) && Number(s) >= 2000 && Number(s) <= 2100,
        t("budget.bdlg.err_annee"),
      ),
      montant: z.string().refine(
        (s) => s.trim() !== "" && Number.isFinite(versNombre(s)) && versNombre(s) >= 0,
        t("budget.bdlg.err_montant"),
      ),
    })
    .superRefine((v, ctx) => {
      if (v.organisme === null) {
        ctx.addIssue({ code: "custom", path: ["organisme"], message: t("budget.bdlg.err_organisme") });
      }
    });
type FormValues = z.infer<ReturnType<typeof schemaTraduction>>;

/** Création (budget = null) ou modification d'un budget annuel d'organisme. */
export function BudgetDialog({ budget, onClose }: { budget: Budget | null; onClose: () => void }) {
  const crud = useCrud<Budget, Record<string, unknown>>("budget/budgets");
  const [erreurServeur, setErreurServeur] = useState<string | null>(null);
  const { t } = useT();

  const form = useForm<FormValues>({
    resolver: zodResolver(schemaTraduction(t)),
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
      title={budget ? t("budget.bdlg.titre_modif") : t("budget.bdlg.titre_nouveau")}
      description={t("budget.bdlg.description")}
      onSubmit={enregistrer}
      submitting={form.formState.isSubmitting}
      error={erreurServeur}
      submitLabel={t("budget.bdlg.enregistrer")}
    >
      <Field
        label={t("budget.bdlg.organisme")} error={erreurs.organisme?.message}
        hint={aDesLignes ? t("budget.bdlg.organisme_verrouille") : undefined}
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
              placeholder={t("budget.bdlg.choisir_organisme")}
              disabled={aDesLignes}
            />
          )}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("budget.bdlg.annee")} htmlFor="annee" error={erreurs.annee?.message}>
          <Input id="annee" inputMode="numeric" maxLength={4} {...form.register("annee")} />
        </Field>
        <Field label={t("budget.bdlg.montant")} htmlFor="montant" error={erreurs.montant?.message}>
          <Input id="montant" inputMode="decimal" {...form.register("montant")} />
        </Field>
      </div>
    </FormDialog>
  );
}