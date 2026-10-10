"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { useT } from "@/lib/i18n/contexte";
import { applyServerErrors } from "@/lib/form-utils";
import { useCrud } from "@/lib/resource";
import type { ConfigSerie } from "@/types/produits";

const schemaTraduction = (t: (c: string) => string) => z.object({
  prefixe: z.string().trim().max(10, t("produits.dialog_config.err_max_10")),
  depart: z.string().refine((s) => /^\d+$/.test(s.trim()), t("produits.dialog_config.err_entier")),
});
type FormValues = z.infer<ReturnType<typeof schemaTraduction>>;

/** Création (config = null) ou modification d'une série de numérotation. */
export function ConfigDialog({ config, onClose }: { config: ConfigSerie | null; onClose: () => void }) {
  const { t } = useT();
  const crud = useCrud<ConfigSerie, Record<string, unknown>>("produits/configs-serie");
  const [erreurServeur, setErreurServeur] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schemaTraduction(t)),
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
      title={config ? t("produits.dialog_config.titre_modifier", { n: config.id_config }) : t("produits.dialog_config.titre_nouveau")}
      description={t("produits.dialog_config.description")}
      onSubmit={enregistrer}
      submitting={form.formState.isSubmitting}
      error={erreurServeur}
    >
      <Field
        label={t("produits.dialog_config.champ_prefixe")} htmlFor="prefixe" error={erreurs.prefixe?.message}
        hint={t("produits.dialog_config.hint_prefixe")}
      >
        <Input id="prefixe" autoFocus {...form.register("prefixe")} />
      </Field>
      <Field
        label={t("produits.dialog_config.champ_depart")} htmlFor="depart" error={erreurs.depart?.message}
        hint={
          config
            ? t("produits.dialog_config.hint_depart_fixe")
            : t("produits.dialog_config.hint_depart_nouveau")
        }
      >
        <Input id="depart" inputMode="numeric" disabled={config !== null} {...form.register("depart")} />
      </Field>
    </FormDialog>
  );
}
