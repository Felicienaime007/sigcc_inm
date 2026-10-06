"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { applyServerErrors } from "@/lib/form-utils";
import { useCrud } from "@/lib/resource";
import type { ConfigSerie } from "@/types/produits";

const schema = z.object({
  prefixe: z.string().trim().max(10, "10 caractères maximum."),
  depart: z.string().refine((s) => /^\d+$/.test(s.trim()), "Saisissez un entier positif ou nul."),
});
type FormValues = z.infer<typeof schema>;

/** Création (config = null) ou modification d'une série de numérotation. */
export function ConfigDialog({ config, onClose }: { config: ConfigSerie | null; onClose: () => void }) {
  const crud = useCrud<ConfigSerie, Record<string, unknown>>("produits/configs-serie");
  const [erreurServeur, setErreurServeur] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      prefixe: config?.prefixe_courant ?? "",
      depart: String(config?.dernier_numero_valide ?? 0),
    },
  });

  const enregistrer = form.handleSubmit(async (v) => {
    setErreurServeur(null);
    const prefixe = v.prefixe.trim() || null;
    try {
      if (config) {
        // le compteur n'est jamais envoyé en modification : il n'évolue que par les lots
        await crud.update.mutateAsync({ id: config.id_config, body: { prefixe_courant: prefixe } });
      } else {
        await crud.create.mutateAsync({ prefixe_courant: prefixe, dernier_numero_valide: Number(v.depart) });
      }
      onClose();
    } catch (e) {
      setErreurServeur(
        applyServerErrors(e, form.setError, ["prefixe", "depart"], {
          prefixe_courant: "prefixe", dernier_numero_valide: "depart",
        }),
      );
    }
  });

  const erreurs = form.formState.errors;

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={config ? `Modifier la série n° ${config.id_config}` : "Nouvelle série de numérotation"}
      description="Une série porte le compteur de numérotation d'un produit (un produit = une série). Elle est ensuite associée à un produit du catalogue."
      onSubmit={enregistrer}
      submitting={form.formState.isSubmitting}
      error={erreurServeur}
    >
      <Field
        label="Préfixe" htmlFor="prefixe" error={erreurs.prefixe?.message}
        hint="Facultatif, 10 caractères au maximum (ex. QT). Un changement ne s'applique qu'aux lots lancés ensuite."
      >
        <Input id="prefixe" autoFocus {...form.register("prefixe")} />
      </Field>
      <Field
        label="Dernier numéro déjà utilisé" htmlFor="depart" error={erreurs.depart?.message}
        hint={
          config
            ? "Non modifiable : le compteur n'avance que par le lancement de lots."
            : "0 pour commencer à 1. Pour reprendre une numérotation existante, saisissez le dernier numéro déjà imprimé."
        }
      >
        <Input id="depart" inputMode="numeric" disabled={config !== null} {...form.register("depart")} />
      </Field>
    </FormDialog>
  );
}