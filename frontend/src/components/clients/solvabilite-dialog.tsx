"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { versNombre } from "@/lib/clients";
import { applyServerErrors } from "@/lib/form-utils";
import { useCrud } from "@/lib/resource";
import type { FicheSolvabilite } from "@/types/clients";

const schema = z.object({
  score_credit: z
    .string()
    .refine(
      (s) => s.trim() !== "" && Number.isFinite(versNombre(s)) && versNombre(s) >= 0 && versNombre(s) <= 100,
      "Le score doit être compris entre 0 et 100.",
    ),
  plafond_encours: z
    .string()
    .refine(
      (s) => s.trim() !== "" && Number.isFinite(versNombre(s)) && versNombre(s) >= 0,
      "Le plafond doit être un montant positif ou nul.",
    ),
  statut_blocage: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

interface Body {
  client?: number;
  score_credit: number;
  plafond_encours: number;
  statut_blocage: boolean;
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

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
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
            statut_blocage: fiche.statut_blocage,
          }
        : { score_credit: "", plafond_encours: "", statut_blocage: false },
    );
  }, [open, fiche, form]);

  const enregistrer = form.handleSubmit(async (v) => {
    setErreurServeur(null);
    const body: Body = {
      score_credit: Math.round(versNombre(v.score_credit) * 100) / 100,
      plafond_encours: Math.round(versNombre(v.plafond_encours) * 100) / 100,
      statut_blocage: v.statut_blocage,
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
      title={fiche ? "Modifier la solvabilité" : "Créer la fiche de solvabilité"}
      description={`Client : ${clientNom}`}
      onSubmit={enregistrer}
      submitting={form.formState.isSubmitting}
      error={erreurServeur}
    >
      <Field label="Score de crédit (0 à 100)" htmlFor="score_credit" error={erreurs.score_credit?.message}>
        <Input id="score_credit" inputMode="decimal" autoFocus {...form.register("score_credit")} />
      </Field>
      <Field
        label="Plafond d'encours (Ar)"
        htmlFor="plafond_encours"
        error={erreurs.plafond_encours?.message}
        hint="Montant maximal de commandes et de factures impayées autorisé pour ce client."
      >
        <Input id="plafond_encours" inputMode="decimal" {...form.register("plafond_encours")} />
      </Field>
      <Controller
        control={form.control}
        name="statut_blocage"
        render={({ field }) => (
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={field.value} onCheckedChange={(c) => field.onChange(c === true)} className="mt-0.5" />
            <span>
              Client bloqué
              <span className="block text-xs text-muted-foreground">
                Aucune commande ne peut être validée tant que le client est bloqué.
              </span>
            </span>
          </label>
        )}
      />
    </FormDialog>
  );
}