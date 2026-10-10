"use client";

import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RemoteSelect } from "@/components/data/remote-select";
import { Field } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { api } from "@/lib/api";
import { versNombre } from "@/lib/clients";
import { entierPositif } from "@/lib/commercial";
import { getErrorMessage } from "@/lib/errors";
import { applyServerErrors } from "@/lib/form-utils";
import { formatAr } from "@/lib/format";
import { useApiMutation, useOptions } from "@/lib/resource";
import { imprimer } from "@/lib/editions";
import { useT } from "@/lib/i18n/contexte";
import type { Facture } from "@/types/commercial";
import type { Caisse, Livre, Reglement } from "@/types/tresorie";

const VOLETS = ["A", "B", "C", "D", "E"];
const MEMO = "sigcc_encaissement";   // caisse et carnet utilisés en dernier sur ce poste

const base = z.object({
  montant: z.string(),
  mode_reglement: z.string(),
  caisse: z.number().nullable(),
  livre: z.number().nullable(),
  num_feuille: z.string(),
  attribut_volet: z.string(),
  num_virement: z.string(),
});
type FormValues = z.infer<typeof base>;

const VIDE: FormValues = {
  montant: "", mode_reglement: "ESPECES", caisse: null, livre: null,
  num_feuille: "", attribut_volet: "", num_virement: "",
};

function creerSchema(mode: "caisse" | "virement", reste: number, t: (c: string, p?: Record<string, string | number>) => string) {
  return base.superRefine((v, ctx) => {
    const m = versNombre(v.montant);
    const centimes = Math.round(m * 100);
    if (!Number.isFinite(m) || centimes <= 0) {
      ctx.addIssue({ code: "custom", path: ["montant"], message: t("tresorerie.reglement.err_montant") });
    } else if (centimes > Math.round(reste * 100)) {
      ctx.addIssue({ code: "custom", path: ["montant"], message: t("tresorerie.reglement.err_depassement", { reste: formatAr(reste) }) });
    }
    if (mode === "virement") {
      if (!v.num_virement.trim()) {
        ctx.addIssue({ code: "custom", path: ["num_virement"], message: t("tresorerie.reglement.err_num_virement") });
      }
      return;
    }
    if (!["ESPECES", "CHEQUE"].includes(v.mode_reglement)) {
      ctx.addIssue({ code: "custom", path: ["mode_reglement"], message: t("tresorerie.reglement.err_mode") });
    }
    if (v.caisse === null) ctx.addIssue({ code: "custom", path: ["caisse"], message: t("tresorerie.reglement.err_caisse") });
    if (v.livre === null) ctx.addIssue({ code: "custom", path: ["livre"], message: t("tresorerie.reglement.err_carnet") });
    const f = entierPositif(v.num_feuille);
    if (f === null || f > 50) {
      ctx.addIssue({ code: "custom", path: ["num_feuille"], message: t("tresorerie.reglement.err_feuille") });
    }
    if (!VOLETS.includes(v.attribut_volet)) {
      ctx.addIssue({ code: "custom", path: ["attribut_volet"], message: t("tresorerie.reglement.err_volet") });
    }
  });
}

function lireMemo(): { caisse: number | null; livre: number | null } {
  try {
    const v = JSON.parse(localStorage.getItem(MEMO) ?? "null");
    return { caisse: v?.caisse ?? null, livre: v?.livre ?? null };
  } catch {
    return { caisse: null, livre: null };
  }
}

function ecrireMemo(caisse: number | null, livre: number | null) {
  try {
    localStorage.setItem(MEMO, JSON.stringify({ caisse, livre }));
  } catch {
    /* stockage indisponible : sans conséquence */
  }
}

/**
 * Règlement d'une facture.
 * mode « caisse » : espèces ou chèque, avec quittance (caissier).
 * mode « virement » : avis de virement du Trésor (comptable).
 */
export function ReglementDialog({
  open, onOpenChange, facture, mode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facture: Facture;
  mode: "caisse" | "virement";
}) {
  const { t } = useT();
  const reste = Number(facture.reste_a_payer);
  const schema = useMemo(() => creerSchema(mode, reste, t), [mode, reste, t]);
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: VIDE });
  const [erreurServeur, setErreurServeur] = useState<string | null>(null);

  const caisses = useOptions<Caisse>("tresorerie/caisses", {}, open && mode === "caisse");
  const creer = useApiMutation(
    async (body: unknown) => (await api.post<Reglement>("/tresorerie/reglements/", body)).data,
    { silentError: true },
  );

  async function suggerer(livreId: number) {
    try {
      const { data } = await api.get<{ num_feuille: number; attribut_volet: string }>(
        `/tresorerie/livres/${livreId}/prochain/`,
      );
      form.setValue("num_feuille", String(data.num_feuille));
      form.setValue("attribut_volet", data.attribut_volet);
      form.clearErrors(["num_feuille", "attribut_volet"]);
      setErreurServeur(null);
    } catch (e) {
      form.setValue("livre", null);   // carnet épuisé ou introuvable : il faut en choisir un autre
      setErreurServeur(getErrorMessage(e, t("tresorerie.reglement.carnet_indisponible")));
    }
  }

  useEffect(() => {
    if (!open) return;
    setErreurServeur(null);
    const memo = mode === "caisse" ? lireMemo() : { caisse: null, livre: null };
    form.reset({
      ...VIDE,
      montant: String(reste),
      mode_reglement: mode === "virement" ? "VIREMENT_TRESOR" : "ESPECES",
      caisse: memo.caisse,
      livre: memo.livre,
    });
    if (memo.livre) void suggerer(memo.livre);
    // Réinitialisation à chaque ouverture uniquement
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Une seule caisse existante : on la choisit d'office
  useEffect(() => {
    if (open && mode === "caisse" && caisses.data?.length === 1 && form.getValues("caisse") === null) {
      form.setValue("caisse", caisses.data[0].id_caisse);
    }
  }, [open, mode, caisses.data, form]);

  const envoyer = form.handleSubmit(async (v) => {
    setErreurServeur(null);
    const montant = Math.round(versNombre(v.montant) * 100) / 100;
    const body =
      mode === "virement"
        ? {
            facture: facture.id_facture, mode_reglement: "VIREMENT_TRESOR",
            montant_regle: montant, num_virement_tresor: v.num_virement.trim(),
          }
        : {
            facture: facture.id_facture, mode_reglement: v.mode_reglement, montant_regle: montant,
            caisse: v.caisse, livre: v.livre,
            num_feuille: Number(v.num_feuille), attribut_volet: v.attribut_volet,
          };
    try {
      const r = await creer.mutateAsync(body);
      if (mode === "caisse") ecrireMemo(v.caisse, v.livre);
      toast.success(
        r.quittance
          ? t("tresorerie.reglement.toast_encaisse", {
              montant: formatAr(r.montant_regle),
              carnet: r.quittance.numero_livre,
              feuille: r.quittance.num_feuille,
              volet: r.quittance.attribut_volet,
            })
          : t("tresorerie.reglement.toast_virement", { montant: formatAr(r.montant_regle) }),
        {
          duration: 10_000,
          action: {
            label: t("tresorerie.reglement.imprimer_recu"),
            onClick: () =>
              void imprimer(`reglement/${r.id_reglement}`, {
                generation: t("tresorerie.editions.generation"),
                document: t("tresorerie.editions.err_document"),
              }),
          },
        },
      );
      onOpenChange(false);
    } catch (e) {
      setErreurServeur(
        applyServerErrors(
          e, form.setError,
          ["montant", "mode_reglement", "caisse", "livre", "num_feuille", "attribut_volet", "num_virement"],
          { montant_regle: "montant", num_virement_tresor: "num_virement" },
        ),
      );
    }
  });

  const erreurs = form.formState.errors;
  const livreChoisi = form.watch("livre");

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "virement" ? t("tresorerie.reglement.titre_virement") : t("tresorerie.reglement.titre_caisse")}
      onSubmit={envoyer}
      submitting={creer.isPending}
      error={erreurServeur}
      submitLabel={mode === "virement" ? t("tresorerie.reglement.submit_virement") : t("tresorerie.reglement.submit_caisse")}
      wide
    >
      <div className="rounded-md border bg-muted/30 p-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-medium">{facture.num_facture}</p>
            <p className="text-xs text-muted-foreground">{facture.nom_client}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{t("tresorerie.reglement.reste")}</p>
            <p className="text-lg font-semibold tabular-nums">{formatAr(reste)}</p>
          </div>
        </div>
      </div>

      <Field
        label={t("tresorerie.reglement.champ_montant")}
        htmlFor="montant"
        error={erreurs.montant?.message}
        hint={t("tresorerie.reglement.hint_montant")}
      >
        <div className="flex gap-2">
          <Input id="montant" inputMode="decimal" autoFocus {...form.register("montant")} />
          <Button type="button" variant="outline" onClick={() => form.setValue("montant", String(reste))}>
            {t("tresorerie.reglement.solde")}
          </Button>
        </div>
      </Field>

      {mode === "virement" ? (
        <Field
          label={t("tresorerie.reglement.champ_num_virement")}
          htmlFor="num_virement"
          error={erreurs.num_virement?.message}
          hint={t("tresorerie.reglement.hint_virement")}
        >
          <Input id="num_virement" {...form.register("num_virement")} />
        </Field>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("tresorerie.reglement.champ_mode")} error={erreurs.mode_reglement?.message}>
              <Controller
                control={form.control}
                name="mode_reglement"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} items={{ ESPECES: t("tresorerie.modes.especes"), CHEQUE: t("tresorerie.modes.cheque") }}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ESPECES">{t("tresorerie.modes.especes")}</SelectItem>
                      <SelectItem value="CHEQUE">{t("tresorerie.modes.cheque")}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label={t("tresorerie.reglement.champ_caisse")} error={erreurs.caisse?.message}>
              <Controller
                control={form.control}
                name="caisse"
                render={({ field }) => (
                  <RemoteSelect<Caisse>
                    path="tresorerie/caisses"
                    value={field.value}
                    onChange={field.onChange}
                    getValue={(c) => c.id_caisse}
                    getLabel={(c) => `${c.code_caisse} — ${c.libelle_caisse}`}
                    placeholder={t("tresorerie.reglement.choisir_caisse")}
                  />
                )}
              />
            </Field>
          </div>

          <div className="rounded-md border p-3">
            <p className="mb-3 text-sm font-medium">{t("tresorerie.reglement.quittance_titre")}</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t("tresorerie.reglement.champ_carnet")} error={erreurs.livre?.message}>
                <Controller
                  control={form.control}
                  name="livre"
                  render={({ field }) => (
                    <RemoteSelect<Livre>
                      path="tresorerie/livres"
                      params={{ statut: "EN_COURS" }}
                      value={field.value}
                      onChange={(id) => {
                        field.onChange(id);
                        if (id !== null) void suggerer(id);
                      }}
                      getValue={(l) => l.id_livre}
                      getLabel={(l) => t("tresorerie.reglement.carnet_label", { numero: l.numero_livre, restants: l.nb_restantes })}
                      placeholder={t("tresorerie.reglement.carnet_encours")}
                    />
                  )}
                />
              </Field>
              <Field label={t("tresorerie.reglement.champ_feuille")} htmlFor="num_feuille" error={erreurs.num_feuille?.message}>
                <Input id="num_feuille" inputMode="numeric" {...form.register("num_feuille")} />
              </Field>
              <Field label={t("tresorerie.reglement.champ_volet")} error={erreurs.attribut_volet?.message}>
                <div className="flex gap-2">
                  <Controller
                    control={form.control}
                    name="attribut_volet"
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        items={Object.fromEntries(VOLETS.map((v) => [v, v]))}
                      >
                        <SelectTrigger className="w-full"><SelectValue placeholder={t("tresorerie.reglement.ph_volet")} /></SelectTrigger>
                        <SelectContent>
                          {VOLETS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <Button
                    type="button" variant="outline" size="icon" title={t("tresorerie.reglement.suggerer")} aria-label={t("tresorerie.reglement.suggerer")}
                    disabled={livreChoisi === null}
                    onClick={() => livreChoisi !== null && void suggerer(livreChoisi)}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </Field>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {t("tresorerie.reglement.hint_quittance")}
            </p>
          </div>
        </>
      )}
    </FormDialog>
  );
}
