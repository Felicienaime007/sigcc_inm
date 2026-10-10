"use client";

import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RemoteSelect } from "@/components/data/remote-select";
import { Field } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { HierarchyPicker } from "@/components/territoire/hierarchy-picker";
import { useAuth } from "@/lib/auth-context";
import { TYPES_CLIENT, estSoa, typesGerables } from "@/lib/clients";
import { applyServerErrors } from "@/lib/form-utils";
import { useT } from "@/lib/i18n/contexte";
import { useCrud } from "@/lib/resource";
import type { Client, Organisme, TypeClient } from "@/types/clients";

const schemaTraduction = (t: (c: string) => string) =>
  z
    .object({
      nom_client: z.string().trim().min(1, t("clients.form.err_nom")).max(150, t("clients.form.err_150")),
      type_client: z.string().min(1, t("clients.form.err_type")),
      code_soa: z.string(),
      organisme: z.number().nullable(),
      fokontany: z.number().nullable(),
      ville: z.string().max(100, t("clients.form.err_100")),
      telephone: z.string().max(30, t("clients.form.err_30")),
      cin_ou_nif: z.string().max(50, t("clients.form.err_50")),
      adresse: z.string(),
    })
    .superRefine((v, ctx) => {
      if (estSoa(v.type_client)) {
        if (!/^\d{5}$/.test(v.code_soa.trim())) {
          ctx.addIssue({ code: "custom", path: ["code_soa"], message: t("clients.form.err_soa") });
        }
        if (v.organisme === null) {
          ctx.addIssue({ code: "custom", path: ["organisme"], message: t("clients.form.err_organisme") });
        }
        if (v.fokontany === null) {
          ctx.addIssue({
            code: "custom", path: ["fokontany"],
            message: t("clients.form.err_fokontany"),
          });
        }
      } else if (v.type_client && !v.ville.trim()) {
        ctx.addIssue({ code: "custom", path: ["ville"], message: t("clients.form.err_ville") });
      }
    });
type FormValues = z.infer<ReturnType<typeof schemaTraduction>>;

interface ClientBody {
  nom_client: string;
  type_client: string;
  code_soa: string | null;
  organisme: number | null;
  fokontany: number | null;
  ville: string | null;
  telephone: string | null;
  cin_ou_nif: string | null;
  adresse: string | null;
}

const VIDE: FormValues = {
  nom_client: "", type_client: "", code_soa: "", organisme: null,
  fokontany: null, ville: "", telephone: "", cin_ou_nif: "", adresse: "",
};

const CHAMPS = [
  "nom_client", "type_client", "code_soa", "organisme",
  "fokontany", "ville", "telephone", "cin_ou_nif", "adresse",
];

/** Création (client = null) ou modification d'un client. */
export function ClientFormDialog({
  open, onOpenChange, client, onSaved, typeImpose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
  onSaved?: (client: Client) => void;   // reçoit le client créé ou modifié
  /**
   * Type imposé par le contexte (ex. "SIMPLE" au comptoir) : pas de sélection
   * multiple, même pour un ADMIN qui gère plusieurs types.
   */
  typeImpose?: TypeClient;
}) {
  const { can } = useAuth();
  const crud = useCrud<Client, ClientBody>("clients/clients");
  const [erreurServeur, setErreurServeur] = useState<string | null>(null);
  const { t } = useT();

  // Types proposés : imposé par le contexte si fourni, sinon ceux que le rôle
  // a le droit de créer (ou de modifier, en édition). En édition on ne change
  // jamais le type via ce dialogue : le type du client est conservé.
  const typesChoix = useMemo(() => {
    if (!client && typeImpose) return TYPES_CLIENT.filter((t) => t.value === typeImpose);
    const ok = typesGerables(can, client ? "update" : "create");
    return TYPES_CLIENT.filter((t) => ok.includes(t.value));
  }, [can, client, typeImpose]);
  const typeUnique = typesChoix.length === 1 ? typesChoix[0] : null;   // ex. réception : SIMPLE seulement

  const form = useForm<FormValues>({ resolver: zodResolver(schemaTraduction(t)), defaultValues: VIDE });
  const type = form.watch("type_client");
  const soa = estSoa(type);

  useEffect(() => {
    if (!open) return;
    setErreurServeur(null);
    form.reset(
      client
        ? {
            nom_client: client.nom_client,
            type_client: client.type_client,
            code_soa: client.code_soa ?? "",
            organisme: client.organisme,
            fokontany: client.fokontany,
            ville: client.ville ?? "",
            telephone: client.telephone ?? "",
            cin_ou_nif: client.cin_ou_nif ?? "",
            adresse: client.adresse ?? "",
          }
        : { ...VIDE, type_client: typeUnique?.value ?? "" },
    );
  }, [open, client, form, typeUnique]);

  const enregistrer = form.handleSubmit(async (v) => {
    setErreurServeur(null);
    const estSoaClient = estSoa(v.type_client);
    // Les champs qui ne concernent pas le type sont envoyés à null (le serveur les refuserait sinon)
    const body: ClientBody = {
      nom_client: v.nom_client,
      type_client: v.type_client,
      code_soa: estSoaClient ? v.code_soa.trim() : null,
      organisme: estSoaClient ? v.organisme : null,
      fokontany: estSoaClient ? v.fokontany : null,
      ville: estSoaClient ? null : v.ville.trim(),
      telephone: v.telephone.trim() || null,
      cin_ou_nif: v.cin_ou_nif.trim() || null,
      adresse: estSoaClient ? v.adresse.trim() || null : null,
    };
    try {
      const saved = client
        ? await crud.update.mutateAsync({ id: client.id_client, body })
        : await crud.create.mutateAsync(body);
      onSaved?.(saved);
      onOpenChange(false);
    } catch (e) {
      setErreurServeur(applyServerErrors(e, form.setError, CHAMPS));
    }
  });

  const erreurs = form.formState.errors;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        client
          ? t("clients.form.titre_modif")
          : typeUnique?.value === "SIMPLE"
            ? t("clients.form.titre_comptoir")
            : t("clients.form.titre_nouveau")
      }
      onSubmit={enregistrer}
      submitting={form.formState.isSubmitting}
      error={erreurServeur}
      submitLabel={t("clients.form.enregistrer")}
      wide={soa}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("clients.form.nom")} htmlFor="nom_client" error={erreurs.nom_client?.message}>
          <Input id="nom_client" autoFocus {...form.register("nom_client")} />
        </Field>

        <Field label={t("clients.form.type")} error={erreurs.type_client?.message}>
          {typeUnique ? (
            <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm">
              {t(`clients.types.${typeUnique.value.toLowerCase()}`)}
            </div>
          ) : (
            <Controller
              control={form.control}
              name="type_client"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(v) => {
                    field.onChange(v);
                    // On vide les champs qui ne concernent plus le nouveau type
                    if (estSoa(v ?? "")) {
                      form.setValue("ville", "");
                      form.clearErrors("ville");
                    } else {
                      form.setValue("code_soa", "");
                      form.setValue("organisme", null);
                      form.setValue("fokontany", null);
                      form.setValue("adresse", "");
                      form.clearErrors(["code_soa", "organisme", "fokontany"]);
                    }
                  }}
                >
                  <SelectTrigger className="w-full"><SelectValue placeholder={t("clients.form.choisir")} /></SelectTrigger>
                  <SelectContent>
                    {typesChoix.map((tc) => (
                      <SelectItem key={tc.value} value={tc.value}>{t(`clients.types.${tc.value.toLowerCase()}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </Field>
      </div>

      {/* SOA : code, organisme, adresse administrative */}
      {soa && (
        <>
          <div className="grid gap-4 rounded-md border bg-muted/30 p-3 sm:grid-cols-2">
            <Field
              label={t("clients.form.code_soa")}
              htmlFor="code_soa"
              error={erreurs.code_soa?.message}
              hint={t("clients.form.code_soa_hint")}
            >
              <Input id="code_soa" inputMode="numeric" maxLength={5} {...form.register("code_soa")} />
            </Field>
            <Field label={t("clients.form.organisme")} error={erreurs.organisme?.message}>
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
                    placeholder={t("clients.form.choisir_organisme")}
                  />
                )}
              />
            </Field>
          </div>

          <Field
            label={t("clients.form.adresse_admin")}
            error={erreurs.fokontany?.message}
            hint={t("clients.form.adresse_admin_hint")}
          >
            <Controller
              control={form.control}
              name="fokontany"
              render={({ field }) => (
                <HierarchyPicker upTo={4} value={field.value} onChange={field.onChange} />
              )}
            />
          </Field>
        </>
      )}

      {/* PRIVE et SIMPLE : localisation par ville seulement */}
      {type && !soa && (
        <Field label={t("clients.form.ville")} htmlFor="ville" error={erreurs.ville?.message}>
          <Input id="ville" placeholder={t("clients.form.ville_ph")} {...form.register("ville")} />
        </Field>
      )}

      {type && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("clients.form.telephone")} htmlFor="telephone" error={erreurs.telephone?.message}>
            <Input id="telephone" inputMode="tel" {...form.register("telephone")} />
          </Field>
          <Field
            label={type === "SIMPLE" ? t("clients.form.cin") : t("clients.form.nif")}
            htmlFor="cin_ou_nif"
            error={erreurs.cin_ou_nif?.message}
          >
            <Input id="cin_ou_nif" {...form.register("cin_ou_nif")} />
          </Field>
        </div>
      )}

      {soa && (
        <Field label={t("clients.form.precisions")} htmlFor="adresse" error={erreurs.adresse?.message} hint={t("clients.form.precisions_hint")}>
          <Textarea id="adresse" rows={2} {...form.register("adresse")} />
        </Field>
      )}
    </FormDialog>
  );
}