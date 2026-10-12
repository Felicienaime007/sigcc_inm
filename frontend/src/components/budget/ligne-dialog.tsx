"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { RemoteSelect } from "@/components/data/remote-select";
import { Field } from "@/components/forms/field";
import { AmountInput } from "@/components/forms/amount-input";
import { FormDialog } from "@/components/forms/form-dialog";
import { versNombre } from "@/lib/clients";
import { applyServerErrors } from "@/lib/form-utils";
import { useT } from "@/lib/i18n/contexte";
import { useCrud } from "@/lib/resource";
import type { Budget, LigneBudget, TypeFinancement } from "@/types/budget";

const schemaTraduction = (t: (c: string) => string) =>
  z.object({
    code_article: z.string().trim().min(1, t("budget.ldlg.err_code")).max(50, t("budget.ldlg.err_50")),
    libelle_ligne: z.string().trim().min(1, t("budget.ldlg.err_libelle")).max(255, t("budget.ldlg.err_255")),
    montant: z.string().refine(
      (s) => s.trim() !== "" && Number.isFinite(versNombre(s)) && versNombre(s) >= 0,
      t("budget.ldlg.err_montant"),
    ),
    type_financement: z.number().nullable(),
  });
type FormValues = z.infer<ReturnType<typeof schemaTraduction>>;

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
  const { t } = useT();
  const verrouille = (ligne?.nb_engagements ?? 0) > 0;   // le solde évolue par les engagements seuls

  const form = useForm<FormValues>({
    resolver: zodResolver(schemaTraduction(t)),
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
      title={ligne ? t("budget.ldlg.titre_modif") : t("budget.ldlg.titre_nouveau")}
      description={t("budget.ldlg.description", { annee: budget.annee_budgetaire, org: budget.nom_organisme })}
      onSubmit={enregistrer}
      submitting={form.formState.isSubmitting}
      error={erreurServeur}
      submitLabel={t("budget.ldlg.enregistrer")}
    >
      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <Field label={t("budget.ldlg.code")} htmlFor="code_article" error={erreurs.code_article?.message}>
          <Input id="code_article" autoFocus {...form.register("code_article")} />
        </Field>
        <Field label={t("budget.ldlg.libelle")} htmlFor="libelle_ligne" error={erreurs.libelle_ligne?.message}>
          <Input id="libelle_ligne" {...form.register("libelle_ligne")} />
        </Field>
      </div>

      <Field
        label={ligne ? t("budget.ldlg.montant_dispo") : t("budget.ldlg.dotation")}
        htmlFor="montant"
        error={erreurs.montant?.message}
        hint={
          verrouille
            ? t("budget.ldlg.montant_verrouille")
            : t("budget.ldlg.montant_hint")
        }
      >
        <Controller
          control={form.control}
          name="montant"
          render={({ field }) => (
            <AmountInput
              id="montant"
              value={field.value.trim() === "" ? null : versNombre(field.value)}
              onChange={(v) => field.onChange(v === null ? "" : String(v))}
              onBlur={field.onBlur}
              name={field.name}
              disabled={verrouille}
            />
          )}
        />
      </Field>

      <Field label={t("budget.ldlg.financement")} error={erreurs.type_financement?.message}>
        <Controller
          control={form.control}
          name="type_financement"
          render={({ field }) => (
            <RemoteSelect<TypeFinancement>
              path="budget/types-financement"
              value={field.value}
              onChange={field.onChange}
              getValue={(tf) => tf.id_type_financement}
              getLabel={(tf) => tf.libelle_financement}
              placeholder={t("budget.ldlg.choisir")}
              allowEmpty
              emptyLabel={t("budget.ldlg.sans_precision")}
            />
          )}
        />
      </Field>
    </FormDialog>
  );
}