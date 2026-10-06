"use client";

import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RemoteSelect } from "@/components/data/remote-select";
import { Field } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { versNombre } from "@/lib/clients";
import { applyServerErrors } from "@/lib/form-utils";
import { useApiMutation, useOptions } from "@/lib/resource";
import type { Categorie, ConfigSerie, ProduitCatalogue } from "@/types/produits";

const schema = z
  .object({
    code_produit: z.string().trim().min(1, "Le code produit est obligatoire.").max(50, "50 caractères maximum."),
    designation: z.string().trim().min(1, "La désignation est obligatoire.").max(150, "150 caractères maximum."),
    prix: z.string().refine(
      (s) => s.trim() !== "" && Number.isFinite(versNombre(s)) && versNombre(s) >= 0,
      "Le prix doit être positif ou nul.",
    ),
    categorie: z.number().nullable(),
    mode: z.enum(["aucune", "nouvelle", "existante"]),
    prefixe: z.string().trim().max(10, "10 caractères maximum."),
    depart: z.string(),
    config: z.number().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.categorie === null) ctx.addIssue({ code: "custom", path: ["categorie"], message: "La catégorie est obligatoire." });
    if (v.mode === "nouvelle" && !/^\d+$/.test(v.depart.trim())) {
      ctx.addIssue({ code: "custom", path: ["depart"], message: "Saisissez un entier positif ou nul." });
    }
    if (v.mode === "existante" && v.config === null) {
      ctx.addIssue({ code: "custom", path: ["config"], message: "Choisissez la série." });
    }
  });
type FormValues = z.infer<typeof schema>;

interface Envoi {
  id?: number;
  produit: Record<string, unknown>;
  nouvelleSerie?: { prefixe_courant: string | null; dernier_numero_valide: number };
}

/** Création (produit = null) ou modification d'un produit du catalogue. */
export function ProduitDialog({ produit, onClose }: { produit: ProduitCatalogue | null; onClose: () => void }) {
  const { can } = useAuth();
  const [erreurServeur, setErreurServeur] = useState<string | null>(null);

  const serieFigee = produit?.config != null;   // déjà numéroté : la série ne se change plus ici
  const peutCreerSerie = can("config_serie.create");
  const configs = useOptions<ConfigSerie>("produits/configs-serie", {}, can("config_serie.view") && !serieFigee);
  const libres = useMemo(() => (configs.data ?? []).filter((c) => c.code_produit === null), [configs.data]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      code_produit: produit?.code_produit ?? "",
      designation: produit?.designation ?? "",
      prix: produit ? String(Number(produit.prix_tarif)) : "",
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
    { success: "Produit enregistré.", silentError: true },
  );

  const envoyer = form.handleSubmit(async (v) => {
    setErreurServeur(null);
    const corps: Record<string, unknown> = {
      code_produit: v.code_produit, designation: v.designation,
      prix_tarif: Math.round(versNombre(v.prix) * 100) / 100, categorie: v.categorie,
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
          ["code_produit", "designation", "prix", "categorie", "prefixe", "depart", "config"],
          { prix_tarif: "prix", prefixe_courant: "prefixe", dernier_numero_valide: "depart" },
        ),
      );
    }
  });

  const erreurs = form.formState.errors;

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={produit ? `Modifier ${produit.code_produit}` : "Nouveau produit"}
      onSubmit={envoyer}
      submitting={enregistrer.isPending}
      error={erreurServeur}
      wide
    >
      <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
        <Field label="Code produit" htmlFor="code_produit" error={erreurs.code_produit?.message} hint="Unique.">
          <Input id="code_produit" autoFocus {...form.register("code_produit")} />
        </Field>
        <Field label="Désignation" htmlFor="designation" error={erreurs.designation?.message}>
          <Input id="designation" {...form.register("designation")} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Catégorie" error={erreurs.categorie?.message}>
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
                placeholder="Choisir la catégorie…"
              />
            )}
          />
        </Field>
        <Field
          label="Prix du tarif (Ar)" htmlFor="prix" error={erreurs.prix?.message}
          hint={produit ? "Le nouveau tarif ne s'applique qu'aux prochains documents ; les documents existants gardent leur prix." : undefined}
        >
          <Input id="prix" inputMode="decimal" {...form.register("prix")} />
        </Field>
      </div>

      <div className="space-y-3 rounded-md border p-3">
        <p className="text-sm font-medium">Numérotation en série</p>

        {serieFigee ? (
          <p className="text-sm text-muted-foreground">
            Ce produit est numéroté en série
            {produit!.prefixe_courant ? ` (préfixe ${produit!.prefixe_courant})` : ""} ; dernier numéro utilisé :{" "}
            <span className="font-medium text-foreground">{produit!.dernier_numero_valide}</span>.
            La série ne se change plus (elle se gère dans l'onglet « Séries de numérotation »).
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
                    Produit non numéroté
                  </label>
                  {peutCreerSerie && (
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={field.value === "nouvelle"} onChange={() => field.onChange("nouvelle")} />
                      Nouvelle série
                    </label>
                  )}
                  {can("config_serie.view") && (
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={field.value === "existante"} onChange={() => field.onChange("existante")} />
                      Série existante libre
                    </label>
                  )}
                </div>
              )}
            />

            {mode === "nouvelle" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Préfixe" htmlFor="prefixe" error={erreurs.prefixe?.message} hint="Facultatif (ex. QT).">
                  <Input id="prefixe" {...form.register("prefixe")} />
                </Field>
                <Field label="Dernier numéro déjà utilisé" htmlFor="depart" error={erreurs.depart?.message}
                  hint="0 pour commencer à 1.">
                  <Input id="depart" inputMode="numeric" {...form.register("depart")} />
                </Field>
              </div>
            )}

            {mode === "existante" && (
              <Field label="Série libre" error={erreurs.config?.message}>
                <Controller
                  control={form.control}
                  name="config"
                  render={({ field }) => (
                    <Select
                      value={field.value !== null ? String(field.value) : ""}
                      onValueChange={(v) => field.onChange(Number(v))}
                      disabled={libres.length === 0}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={libres.length === 0 ? "Aucune série libre" : "Choisir la série…"} />
                      </SelectTrigger>
                      <SelectContent>
                        {libres.map((c) => (
                          <SelectItem key={c.id_config} value={String(c.id_config)}>
                            Série n° {c.id_config}{c.prefixe_courant ? ` · préfixe ${c.prefixe_courant}` : ""} · dernier n° {c.dernier_numero_valide}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {libres.length === 0 && !configs.isLoading && (
                  <p className="mt-1 text-xs text-amber-700">
                    Aucune série libre : demandez à la production d'en créer une (onglet « Séries de numérotation »).
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