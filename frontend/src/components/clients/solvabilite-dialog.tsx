"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { AmountInput } from "@/components/forms/amount-input";
import { Field } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { versNombre } from "@/lib/clients";
import { applyServerErrors } from "@/lib/form-utils";
import { useT } from "@/lib/i18n/contexte";
import { useCrud } from "@/lib/resource";
import type { FicheSolvabilite } from "@/types/clients";

const schemaTraduction = (t: (c: string) => string) =>
  z.object({
    score_credit: z
      .string()
      .refine(
        (s) => s.trim() !== "" && Number.isFinite(versNombre(s)) && versNombre(s) >= 0 && versNombre(s) <= 100,
        t("clients.svdlg.err_score"),
      ),
    plafond_encours: z
      .string()
      .refine(
        (s) => s.trim() !== "" && Number.isFinite(versNombre(s)) && versNombre(s) >= 0,
        t("clients.svdlg.err_plafond"),
      ),
    statut_blocage: z.boolean(),
  });
type FormValues = z.infer<ReturnType<typeof schemaTraduction>>;

interface Body {
  client?: number;
  score_credit: number;
  plafond_encours: number;
  /** Oracle NUMBER(1) : 0 = actif, 1 = bloqué (le booléen est rejeté par l'API). */
  statut_blocage: number;
}

/** Création (fiche = null) ou modification de la fiche de solvabilité d'un client PRIVE. */
export function SolvabiliteDialog({
  open, onOpenChange, clientId, clientNom, fiche,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: number;
  clientNom: string;
  fiche: FicheSolvabilite | null;
}) {
  const crud = useCrud<FicheSolvabilite, Body>("clients/solvabilites");
  const [erreurServeur, setErreurServeur] = useState<string | null>(null);
  const { t } = useT();

  const form = useForm<FormValues>({
    resolver: zodResolver(schemaTraduction(t)),
    defaultValues: { score_credit: "", plafond_encours: "", statut_blocage: false },
  });

  useEffect(() => {
    if (!open) return;
    // Réinitialisation légitime à l'ouverture : nouvelle fiche ou nouvelle tentative,
    // l'ancienne erreur serveur ne doit pas persister.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setErreurServeur(null);
    form.reset(
      fiche
        ? {
            score_credit: String(fiche.score_credit ?? ""),
            plafond_encours: String(fiche.plafond_encours ?? ""),
            // L'API renvoie 0/1 (NUMBER Oracle) : on convertit en booléen pour la case à cocher.
            statut_blocage: Boolean(fiche.statut_blocage),
          }
        : { score_credit: "", plafond_encours: "", statut_blocage: false },
    );
  }, [open, fiche, form]);

  const enregistrer = form.handleSubmit(async (v) => {
    setErreurServeur(null);
    const body: Body = {
      score_credit: Math.round(versNombre(v.score_credit) * 100) / 100,
      plafond_encours: Math.round(versNombre(v.plafond_encours) * 100) / 100,
      statut_blocage: v.statut_blocage ? 1 : 0,
    };
    try {
      if (fiche) await crud.update.mutateAsync({ id: fiche.id_solvabilite, body });
      else await crud.create.mutateAsync({ ...body, client: clientId });
      onOpenChange(false);
    } catch (e) {
      setErreurServeur(applyServerErrors(e, form.setError, ["score_credit", "plafond_encours", "statut_blocage"]));
    }
  });

  const erreurs = form.formState.errors;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={fiche ? t("clients.svdlg.titre_modif") : t("clients.svdlg.titre_nouveau")}
      description={t("clients.svdlg.description", { nom: clientNom })}
      onSubmit={enregistrer}
      submitting={form.formState.isSubmitting}
      error={erreurServeur}
      submitLabel={t("clients.svdlg.enregistrer")}
    >
      <Field label={t("clients.svdlg.score")} htmlFor="score_credit" error={erreurs.score_credit?.message}>
        <Input id="score_credit" inputMode="decimal" autoFocus {...form.register("score_credit")} />
      </Field>
      <Field
        label={t("clients.svdlg.plafond")}
        htmlFor="plafond_encours"
        error={erreurs.plafond_encours?.message}
        hint={t("clients.svdlg.plafond_hint")}
      >
        <Controller
          control={form.control}
          name="plafond_encours"
          render={({ field }) => (
            <AmountInput
              id="plafond_encours"
              value={field.value.trim() === "" ? null : versNombre(field.value)}
              onChange={(v) => field.onChange(v === null ? "" : String(v))}
              onBlur={field.onBlur}
              name={field.name}
            />
          )}
        />
      </Field>
      <Controller
        control={form.control}
        name="statut_blocage"
        render={({ field }) => (
          <div>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={field.value} onCheckedChange={(c) => field.onChange(c === true)} className="mt-0.5" />
              <span>
                {t("clients.svdlg.bloque")}
                <span className="block text-xs text-muted-foreground">
                  {t("clients.svdlg.bloque_hint")}
                </span>
              </span>
            </label>
            {erreurs.statut_blocage?.message && (
              <p role="alert" className="mt-1 text-xs text-destructive">{erreurs.statut_blocage.message}</p>
            )}
          </div>
        )}
      />
    </FormDialog>
  );
}