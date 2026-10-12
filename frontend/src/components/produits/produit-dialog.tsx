"use client";

import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RemoteSelect } from "@/components/data/remote-select";
import { Field } from "@/components/forms/field";
import { AmountInput } from "@/components/forms/amount-input";
import { FormDialog } from "@/components/forms/form-dialog";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { versNombre } from "@/lib/clients";
import { applyServerErrors } from "@/lib/form-utils";
import { useT } from "@/lib/i18n/contexte";
import { useApiMutation, useOptions } from "@/lib/resource";
import type { Categorie, ConfigSerie, ProduitCatalogue } from "@/types/produits";

const schemaTraduction = (t: (c: string) => string) => z
  .object({
    code_produit: z.string().trim().min(1, t("produits.dialog_produit.err_code")).max(50, t("produits.dialog_produit.err_max_50")),
    designation: z.string().trim().min(1, t("produits.dialog_produit.err_designation")).max(150, t("produits.dialog_produit.err_max_150")),
    prix: z.string().refine(
      (s) => s.trim() !== "" && Number.isFinite(versNombre(s)) && versNombre(s) >= 0,
      t("produits.dialog_produit.err_prix"),
    ),
    seuil: z.string().refine(
      (s) => s.trim() === "" || (Number.isFinite(versNombre(s)) && Math.round(versNombre(s)) >= 0),
      t("produits.dialog_produit.err_seuil"),
    ),
    categorie: z.number().nullable(),
    mode: z.enum(["aucune", "nouvelle", "existante"]),
    prefixe: z.string().trim().max(10, t("produits.dialog_produit.err_max_10")),
    depart: z.string(),
    config: z.number().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.categorie === null) ctx.addIssue({ code: "custom", path: ["categorie"], message: t("produits.dialog_produit.err_categorie") });
    if (v.mode === "nouvelle" && !/^\d+$/.test(v.depart.trim())) {
      ctx.addIssue({ code: "custom", path: ["depart"], message: t("produits.dialog_produit.err_entier") });
    }
    if (v.mode === "existante" && v.config === null) {
      ctx.addIssue({ code: "custom", path: ["config"], message: t("produits.dialog_produit.err_serie") });
    }
  });
type FormValues = z.infer<ReturnType<typeof schemaTraduction>>;

interface Envoi {
  id?: number;
  produit: Record<string, unknown>;
  nouvelleSerie?: { prefixe_courant: string | null; dernier_numero_valide: number };
}

/** Création (produit = null) ou modification d'un produit du catalogue. */
export function ProduitDialog({ produit, onClose }: { produit: ProduitCatalogue | null; onClose: () => void }) {
  const { can } = useAuth();
  const { t } = useT();
  const [erreurServeur, setErreurServeur] = useState<string | null>(null);

  const serieFigee = produit?.config != null;   // déjà numéroté : la série ne se change plus ici
  const peutCreerSerie = can("config_serie.create");
  const configs = useOptions<ConfigSerie>("produits/configs-serie", {}, can("config_serie.view") && !serieFigee);
  const libres = useMemo(() => (configs.data ?? []).filter((c) => c.code_produit === null), [configs.data]);
  const libelleSerie = (c: ConfigSerie) =>
    c.prefixe_courant
      ? t("produits.dialog_produit.serie_avec_prefixe", { p: c.prefixe_courant, n: c.dernier_numero_valide })
      : t("produits.dialog_produit.serie_sans_prefixe", { id: c.id_config, n: c.dernier_numero_valide });

  const form = useForm<FormValues>({
    resolver: zodResolver(schemaTraduction(t)),
    defaultValues: {
      code_produit: produit?.code_produit ?? "",
      designation: produit?.designation ?? "",
      prix: produit ? String(Number(produit.prix_tarif)) : "",
      seuil: produit ? String(produit.seuil_alerte ?? 0) : "0",
      categorie: produit?.categorie ?? null,
      mode: "aucune", prefixe: "", depart: "0", config: null,
    },
  });
  const mode = form.watch("mode");

  const enregistrer = useApiMutation(
    async (a: Envoi) => {
      let configId: number | undefined;
      let creee: number | null = null;
      if (a.nouvelleSerie) {
        const { data } = await api.post<ConfigSerie>("/produits/configs-serie/", a.nouvelleSerie);
        creee = data.id_config;
        configId = creee;
      }
      const body = { ...a.produit, ...(configId !== undefined ? { config: configId } : {}) };
      try {
        return a.id
          ? (await api.patch<ProduitCatalogue>(`/produits/${a.id}/`, body)).data
          : (await api.post<ProduitCatalogue>("/produits/", body)).data;
      } catch (e) {
        // Pas de série orpheline si la création du produit échoue
        if (creee !== null) {
          try { await api.delete(`/produits/configs-serie/${creee}/`); } catch { /* sans conséquence */ }
        }
        throw e;
      }
    },
    { success: t("produits.dialog_produit.success"), silentError: true },
  );

  const envoyer = form.handleSubmit(async (v) => {
    setErreurServeur(null);
    const corps: Record<string, unknown> = {
      code_produit: v.code_produit, designation: v.designation,
      prix_tarif: Math.round(versNombre(v.prix) * 100) / 100, categorie: v.categorie,
      seuil_alerte: Math.max(0, Math.round(versNombre(v.seuil || "0"))),
    };
    if (!serieFigee && v.mode === "existante") corps.config = v.config;
    try {
      await enregistrer.mutateAsync({
        id: produit?.id_produit,
        produit: corps,
        nouvelleSerie:
          !serieFigee && v.mode === "nouvelle"
            ? { prefixe_courant: v.prefixe.trim() || null, dernier_numero_valide: Number(v.depart) }
            : undefined,
      });
      onClose();
    } catch (e) {
      setErreurServeur(
        applyServerErrors(
          e, form.setError,
          ["code_produit", "designation", "prix", "seuil", "categorie", "prefixe", "depart", "config"],
          { prix_tarif: "prix", seuil_alerte: "seuil", prefixe_courant: "prefixe", dernier_numero_valide: "depart" },
        ),
      );
    }
  });

  const erreurs = form.formState.errors;

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={produit ? t("produits.dialog_produit.titre_modifier", { code: produit.code_produit }) : t("produits.dialog_produit.titre_nouveau")}
      onSubmit={envoyer}
      submitting={enregistrer.isPending}
      error={erreurServeur}
      wide
    >
      <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
        <Field label={t("produits.dialog_produit.champ_code")} htmlFor="code_produit" error={erreurs.code_produit?.message} hint={t("produits.dialog_produit.hint_code")}>
          <Input id="code_produit" autoFocus {...form.register("code_produit")} />
        </Field>
        <Field label={t("produits.dialog_produit.champ_designation")} htmlFor="designation" error={erreurs.designation?.message}>
          <Input id="designation" {...form.register("designation")} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("produits.dialog_produit.champ_categorie")} error={erreurs.categorie?.message}>
          <Controller
            control={form.control}
            name="categorie"
            render={({ field }) => (
              <RemoteSelect<Categorie>
                path="produits/categories"
                value={field.value}
                onChange={field.onChange}
                getValue={(c) => c.id_categorie}
                getLabel={(c) => c.libelle_categorie}
                placeholder={t("produits.dialog_produit.ph_categorie")}
              />
            )}
          />
        </Field>
        <Field
          label={t("produits.dialog_produit.champ_prix")} htmlFor="prix" error={erreurs.prix?.message}
          hint={produit ? t("produits.dialog_produit.hint_prix") : undefined}
        >
          <Controller
            control={form.control}
            name="prix"
            render={({ field }) => (
              <AmountInput
                id="prix"
                value={field.value.trim() === "" ? null : versNombre(field.value)}
                onChange={(v) => field.onChange(v === null ? "" : String(v))}
                onBlur={field.onBlur}
                name={field.name}
              />
            )}
          />
        </Field>
        <Field
          label={t("produits.dialog_produit.champ_seuil")} htmlFor="seuil" error={erreurs.seuil?.message}
          hint={t("produits.dialog_produit.hint_seuil")}
        >
          <Input id="seuil" inputMode="numeric" {...form.register("seuil")} />
        </Field>
      </div>

      <div className="space-y-3 rounded-md border p-3">
        <p className="text-sm font-medium">{t("produits.dialog_produit.section_serie")}</p>

        {serieFigee ? (
          <p className="text-sm text-muted-foreground">
            {t("produits.dialog_produit.msg_serie_figee", {
              complement: produit!.prefixe_courant ? t("produits.dialog_produit.complement_prefixe", { p: produit!.prefixe_courant }) : "",
              dernier: produit!.dernier_numero_valide ?? "",
            })}
          </p>
        ) : (
          <>
            <Controller
              control={form.control}
              name="mode"
              render={({ field }) => (
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={field.value === "aucune"} onChange={() => field.onChange("aucune")} />
                    {t("produits.dialog_produit.mode_aucune")}
                  </label>
                  {peutCreerSerie && (
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={field.value === "nouvelle"} onChange={() => field.onChange("nouvelle")} />
                      {t("produits.dialog_produit.mode_nouvelle")}
                    </label>
                  )}
                  {can("config_serie.view") && (
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={field.value === "existante"} onChange={() => field.onChange("existante")} />
                      {t("produits.dialog_produit.mode_existante")}
                    </label>
                  )}
                </div>
              )}
            />

            {mode === "nouvelle" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("produits.dialog_produit.champ_prefixe")} htmlFor="prefixe" error={erreurs.prefixe?.message} hint={t("produits.dialog_produit.hint_prefixe")}>
                  <Input id="prefixe" {...form.register("prefixe")} />
                </Field>
                <Field label={t("produits.dialog_produit.champ_depart")} htmlFor="depart" error={erreurs.depart?.message}
                  hint={t("produits.dialog_produit.hint_depart")}>
                  <Input id="depart" inputMode="numeric" {...form.register("depart")} />
                </Field>
              </div>
            )}

            {mode === "existante" && (
              <Field label={t("produits.dialog_produit.champ_serie_libre")} error={erreurs.config?.message}>
                <Controller
                  control={form.control}
                  name="config"
                  render={({ field }) => (
                    <Select
                      value={field.value !== null ? String(field.value) : ""}
                      onValueChange={(v) => field.onChange(Number(v))}
                      disabled={libres.length === 0}
                      items={Object.fromEntries(libres.map((c) => [String(c.id_config), libelleSerie(c)]))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={libres.length === 0 ? t("produits.dialog_produit.ph_aucune_libre") : t("produits.dialog_produit.ph_choisir")} />
                      </SelectTrigger>
                      <SelectContent>
                        {libres.map((c) => (
                          <SelectItem key={c.id_config} value={String(c.id_config)}>
                            {libelleSerie(c)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {libres.length === 0 && !configs.isLoading && (
                  <p className="mt-1 text-xs text-amber-700">
                    {t("produits.dialog_produit.msg_aucune_libre")}
                  </p>
                )}
              </Field>
            )}
          </>
        )}
      </div>
    </FormDialog>
  );
}
