"use client";

import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { BookmarkCheck, Landmark, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RequirePrivilege } from "@/components/can";
import { PageHeader } from "@/components/page-header";
import { DataTable, type Column } from "@/components/data/data-table";
import { DateRange } from "@/components/data/data-range";
import { FilterSelect } from "@/components/data/filter-select";
import { RemoteSelect } from "@/components/data/remote-select";
import { SearchInput } from "@/components/data/search-input";
import { StatusBadge } from "@/components/data/status-badge";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { Field } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { usePagedList } from "@/hooks/use-paged-list";
import { useAuth } from "@/lib/auth-context";
import { versNombre } from "@/lib/clients";
import { applyServerErrors } from "@/lib/form-utils";
import { formatAr, formatDate, formatDateTime, dateLocaleISO } from "@/lib/format";
import { useCrud, useOptions, useRecordAction } from "@/lib/resource";
import { useT } from "@/lib/i18n/contexte";
import { cn } from "@/lib/utils";
import type { ArreteCaisse, Caisse, EcritureCaisse, RemiseBanque } from "@/types/tresorie";
import { COUPURES, lireComptage } from "@/types/tresorie";

export default function CaissesPage() {
  return (
    <RequirePrivilege privilege={["caisse.view", "livre_caisse.view"]}>
      <Contenu />
    </RequirePrivilege>
  );
}

function Contenu() {
  const { t } = useT();
  const { can } = useAuth();
  const onglets = [
    can("caisse.view") && { id: "caisses", label: t("tresorerie.caisses.onglet_caisses") },
    can("livre_caisse.view") && { id: "journal", label: t("tresorerie.caisses.onglet_journal") },
    can("arrete_caisse.view") && { id: "arretes", label: t("tresorerie.caisses.onglet_arretes") },
    can("remise_banque.view") && { id: "remises", label: t("tresorerie.caisses.onglet_remises") },
  ].filter(Boolean) as { id: string; label: string }[];
  const [choix, setChoix] = useState<string | null>(null);
  const actif = onglets.find((o) => o.id === choix)?.id ?? onglets[0]?.id;
  if (!actif) return null;

  return (
    <div>
      <PageHeader
        title={t("tresorerie.caisses.titre")}
        description={t("tresorerie.caisses.description")}
      />
      <Tabs value={actif} onValueChange={setChoix}>
        <TabsList>
          {onglets.map((o) => <TabsTrigger key={o.id} value={o.id}>{o.label}</TabsTrigger>)}
        </TabsList>
        <TabsContent value="caisses" className="mt-6"><CaissesTab /></TabsContent>
        <TabsContent value="journal" className="mt-6"><JournalTab /></TabsContent>
        <TabsContent value="arretes" className="mt-6"><ArretesTab /></TabsContent>
        <TabsContent value="remises" className="mt-6"><RemisesTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ----------------------------------------------------------------- Caisses
const schemaCaisseTraduction = (t: (c: string) => string) => z.object({
  code_caisse: z.string().trim().min(1, t("tresorerie.caisses.err_code_requis")).max(20, t("tresorerie.caisses.err_code_max")),
  libelle_caisse: z.string().trim().min(1, t("tresorerie.caisses.err_libelle_requis")).max(100, t("tresorerie.caisses.err_libelle_max")),
});
type CaisseForm = z.infer<ReturnType<typeof schemaCaisseTraduction>>;
type EditionCaisse = { mode: "create" } | { mode: "edit"; item: Caisse } | null;

function CaissesTab() {
  const { t } = useT();
  const { can } = useAuth();
  const liste = usePagedList<Caisse>("tresorerie/caisses", { pageSize: 50, ordering: "code_caisse" });
  const crud = useCrud<Caisse, CaisseForm>("tresorerie/caisses");

  const [edition, setEdition] = useState<EditionCaisse>(null);
  const [aSupprimer, setASupprimer] = useState<Caisse | null>(null);
  const [erreurServeur, setErreurServeur] = useState<string | null>(null);

  const schema = useMemo(() => schemaCaisseTraduction(t), [t]);
  const form = useForm<CaisseForm>({
    resolver: zodResolver(schema),
    defaultValues: { code_caisse: "", libelle_caisse: "" },
  });

  useEffect(() => {
    if (!edition) return;
    setErreurServeur(null);
    form.reset(
      edition.mode === "edit"
        ? { code_caisse: edition.item.code_caisse, libelle_caisse: edition.item.libelle_caisse }
        : { code_caisse: "", libelle_caisse: "" },
    );
  }, [edition, form]);

  const enregistrer = form.handleSubmit(async (v) => {
    setErreurServeur(null);
    try {
      if (edition?.mode === "edit") await crud.update.mutateAsync({ id: edition.item.id_caisse, body: v });
      else await crud.create.mutateAsync(v);
      setEdition(null);
    } catch (e) {
      setErreurServeur(applyServerErrors(e, form.setError, ["code_caisse", "libelle_caisse"]));
    }
  });

  async function supprimer() {
    if (!aSupprimer) return;
    try {
      await crud.remove.mutateAsync(aSupprimer.id_caisse);
    } catch {
      /* 409 : la caisse a un historique */
    }
    setASupprimer(null);
  }

  const total = (liste.query.data?.results ?? []).reduce((s, c) => s + Number(c.solde_actuel), 0);

  const colonnes: Column<Caisse>[] = [
    { key: "code", header: "tresorerie.caisses.col_code", sortKey: "code_caisse", cell: (c) => <code className="text-xs">{c.code_caisse}</code> },
    { key: "libelle", header: "tresorerie.caisses.col_caisse", sortKey: "libelle_caisse", cell: (c) => <span className="font-medium">{c.libelle_caisse}</span> },
    {
      key: "solde", header: "tresorerie.caisses.col_solde", className: "text-right tabular-nums font-semibold",
      cell: (c) => formatAr(c.solde_actuel),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Card>
          <CardContent className="px-5 py-3">
            <p className="text-xs text-muted-foreground">{t("tresorerie.caisses.total")}</p>
            <p className="text-2xl font-semibold tabular-nums">{formatAr(total)}</p>
          </CardContent>
        </Card>
        {can("caisse.create") && (
          <Button onClick={() => setEdition({ mode: "create" })}>
            <Plus className="mr-2 h-4 w-4" /> {t("tresorerie.caisses.nouvelle")}
          </Button>
        )}
      </div>

      <SearchInput value={liste.searchInput} onChange={liste.setSearchInput} placeholder={t("tresorerie.caisses.recherche")} />

      <DataTable
        columns={colonnes}
        data={liste.query.data}
        isLoading={liste.query.isLoading}
        isFetching={liste.query.isFetching}
        error={liste.query.error}
        rowKey={(c) => c.id_caisse}
        page={liste.page} pageSize={liste.pageSize} onPageChange={liste.setPage}
        ordering={liste.ordering} onOrderingChange={liste.setOrdering}
        emptyMessage="tresorerie.caisses.vide"
        actions={(c) => (
          <>
            {can("caisse.update") && (
              <Button variant="ghost" size="icon" title={t("tresorerie.caisses.modifier")} aria-label={t("tresorerie.caisses.modifier")} onClick={() => setEdition({ mode: "edit", item: c })}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {can("caisse.delete") && (
              <Button variant="ghost" size="icon" title={t("tresorerie.caisses.supprimer")} aria-label={t("tresorerie.caisses.supprimer")} onClick={() => setASupprimer(c)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </>
        )}
      />

      <FormDialog
        open={edition !== null}
        onOpenChange={(o) => !o && setEdition(null)}
        title={edition?.mode === "edit" ? t("tresorerie.caisses.edit_titre") : t("tresorerie.caisses.create_titre")}
        description={t("tresorerie.caisses.dialog_desc")}
        onSubmit={enregistrer}
        submitting={form.formState.isSubmitting}
        error={erreurServeur}
      >
        <Field label={t("tresorerie.caisses.champ_code")} htmlFor="code_caisse" error={form.formState.errors.code_caisse?.message} hint={t("tresorerie.caisses.hint_code")}>
          <Input id="code_caisse" autoFocus {...form.register("code_caisse")} />
        </Field>
        <Field label={t("tresorerie.caisses.champ_libelle")} htmlFor="libelle_caisse" error={form.formState.errors.libelle_caisse?.message}>
          <Input id="libelle_caisse" {...form.register("libelle_caisse")} />
        </Field>
      </FormDialog>

      <ConfirmDialog
        open={aSupprimer !== null}
        onOpenChange={(o) => !o && setASupprimer(null)}
        title={t("tresorerie.caisses.suppr_titre")}
        description={t("tresorerie.caisses.suppr_desc", { libelle: aSupprimer?.libelle_caisse ?? "" })}
        confirmLabel={t("tresorerie.caisses.suppr_btn")}
        destructive
        loading={crud.remove.isPending}
        onConfirm={supprimer}
      />
    </div>
  );
}

// -------------------------------------------------------------- Livre de caisse
const schemaOperationTraduction = (t: (c: string) => string) => z.object({
  caisse: z.number().nullable(),
  type_operation: z.enum(["ENTREE", "SORTIE"]),
  montant_op: z.string(),
  reference: z.string().trim().min(1, t("tresorerie.journal.err_motif")).max(100, t("tresorerie.journal.err_max")),
}).superRefine((v, ctx) => {
  if (v.caisse === null) ctx.addIssue({ code: "custom", path: ["caisse"], message: t("tresorerie.journal.err_caisse") });
  const m = versNombre(v.montant_op);
  if (!Number.isFinite(m) || Math.round(m * 100) <= 0) {
    ctx.addIssue({ code: "custom", path: ["montant_op"], message: t("tresorerie.journal.err_montant") });
  }
});
type OperationForm = z.infer<ReturnType<typeof schemaOperationTraduction>>;

function JournalTab() {
  const { t } = useT();
  const { can } = useAuth();
  const liste = usePagedList<EcritureCaisse>("tresorerie/livre-caisse", { ordering: "-date_operation" });
  const crud = useCrud<EcritureCaisse, unknown>("tresorerie/livre-caisse");
  const { data: caisses } = useOptions<Caisse>("tresorerie/caisses", {}, can("caisse.view"));

  const [ouvert, setOuvert] = useState(false);
  const [erreurServeur, setErreurServeur] = useState<string | null>(null);

  const schema = useMemo(() => schemaOperationTraduction(t), [t]);
  const form = useForm<OperationForm>({
    resolver: zodResolver(schema),
    defaultValues: { caisse: null, type_operation: "SORTIE", montant_op: "", reference: "" },
  });

  useEffect(() => {
    if (!ouvert) return;
    setErreurServeur(null);
    form.reset({
      caisse: caisses?.length === 1 ? caisses[0].id_caisse : null,
      type_operation: "SORTIE", montant_op: "", reference: "",
    });
  }, [ouvert, caisses, form]);

  const enregistrer = form.handleSubmit(async (v) => {
    setErreurServeur(null);
    try {
      await crud.create.mutateAsync({
        caisse: v.caisse, type_operation: v.type_operation,
        montant_op: Math.round(versNombre(v.montant_op) * 100) / 100, reference: v.reference,
      });
      setOuvert(false);
    } catch (e) {
      setErreurServeur(applyServerErrors(e, form.setError, ["caisse", "type_operation", "montant_op", "reference"]));
    }
  });

  const colonnes: Column<EcritureCaisse>[] = [
    { key: "date", header: "tresorerie.journal.col_date", sortKey: "date_operation", cell: (e) => formatDateTime(e.date_operation) },
    { key: "caisse", header: "tresorerie.journal.col_caisse", cell: (e) => e.code_caisse },
    {
      key: "type", header: "tresorerie.journal.col_operation",
      cell: (e) => (
        <span className={cn(
          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
          e.type_operation === "ENTREE" ? "bg-green-100 dark:bg-green-900/60 text-green-800 dark:text-green-200" : "bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200",
        )}>
          {e.type_operation === "ENTREE" ? t("tresorerie.journal.entree") : t("tresorerie.journal.sortie")}
        </span>
      ),
    },
    {
      key: "montant", header: "tresorerie.journal.col_montant", className: "text-right tabular-nums", sortKey: "montant_op",
      cell: (e) => (
        <span className={e.type_operation === "ENTREE" ? "text-green-700" : "text-amber-700"}>
          {e.type_operation === "ENTREE" ? "+" : "−"} {formatAr(e.montant_op)}
        </span>
      ),
    },
    {
      key: "ref", header: "tresorerie.journal.col_reference",
      cell: (e) => (e.num_facture ? t("tresorerie.journal.encaissement", { num: e.num_facture }) : (e.reference ?? "—")),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={liste.searchInput} onChange={liste.setSearchInput} placeholder={t("tresorerie.journal.recherche")} />
          <FilterSelect
            label={t("tresorerie.journal.filtre_caisse")} className="w-48"
            options={(caisses ?? []).map((c) => ({ value: String(c.id_caisse), label: c.code_caisse }))}
            value={String(liste.filters.caisse ?? "")}
            onChange={(v) => liste.setFilter("caisse", v)}
          />
          <FilterSelect
            label={t("tresorerie.journal.filtre_operation")} className="w-44"
            options={[{ value: "ENTREE", label: t("tresorerie.journal.opt_entrees") }, { value: "SORTIE", label: t("tresorerie.journal.opt_sorties") }]}
            value={String(liste.filters.type ?? "")}
            onChange={(v) => liste.setFilter("type", v)}
          />
          <DateRange
            du={String(liste.filters.du ?? "")}
            au={String(liste.filters.au ?? "")}
            onChange={(cle, v) => liste.setFilter(cle, v)}
          />
        </div>
        {can("livre_caisse.create") && (
          <Button onClick={() => setOuvert(true)}>
            <Plus className="mr-2 h-4 w-4" /> {t("tresorerie.journal.nouveau")}
          </Button>
        )}
      </div>

      <DataTable
        columns={colonnes}
        data={liste.query.data}
        isLoading={liste.query.isLoading}
        isFetching={liste.query.isFetching}
        error={liste.query.error}
        rowKey={(e) => e.id_livre_caisse}
        page={liste.page} pageSize={liste.pageSize} onPageChange={liste.setPage}
        ordering={liste.ordering} onOrderingChange={liste.setOrdering}
        emptyMessage="tresorerie.journal.vide"
      />

      <FormDialog
        open={ouvert}
        onOpenChange={setOuvert}
        title={t("tresorerie.journal.dialog_titre")}
        description={t("tresorerie.journal.dialog_desc")}
        onSubmit={enregistrer}
        submitting={form.formState.isSubmitting}
        error={erreurServeur}
        submitLabel={t("tresorerie.journal.submit")}
      >
        <Field label={t("tresorerie.journal.champ_caisse")} error={form.formState.errors.caisse?.message}>
          <Controller
            control={form.control}
            name="caisse"
            render={({ field }) => (
              <RemoteSelect<Caisse>
                path="tresorerie/caisses"
                value={field.value}
                onChange={field.onChange}
                getValue={(c) => c.id_caisse}
                getLabel={(c) => `${c.code_caisse} — ${c.libelle_caisse} (${formatAr(c.solde_actuel)})`}
                placeholder={t("tresorerie.journal.choisir_caisse")}
              />
            )}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("tresorerie.journal.champ_type")} error={form.formState.errors.type_operation?.message}>
            <Controller
              control={form.control}
              name="type_operation"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  items={{ SORTIE: t("tresorerie.journal.opt_sortie"), ENTREE: t("tresorerie.journal.opt_entree") }}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SORTIE">{t("tresorerie.journal.opt_sortie")}</SelectItem>
                    <SelectItem value="ENTREE">{t("tresorerie.journal.opt_entree")}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label={t("tresorerie.journal.champ_montant")} htmlFor="montant_op" error={form.formState.errors.montant_op?.message}>
            <Input id="montant_op" inputMode="decimal" {...form.register("montant_op")} />
          </Field>
        </div>
        <Field label={t("tresorerie.journal.champ_motif")} htmlFor="reference" error={form.formState.errors.reference?.message}
          hint={t("tresorerie.journal.hint_motif")}>
          <Input id="reference" {...form.register("reference")} />
        </Field>
      </FormDialog>
    </div>
  );
}

// ------------------------------------------------------- Arrêtés journaliers
const schemaArreteTraduction = (t: (c: string, p?: Record<string, string | number>) => string) => z.object({
  caisse: z.number().nullable(),
  date_arrete: z.string().min(1, t("tresorerie.arretes.err_date")),
  coupures: z.record(z.string(), z.string()),
}).superRefine((v, ctx) => {
  if (v.caisse === null) ctx.addIssue({ code: "custom", path: ["caisse"], message: t("tresorerie.arretes.err_caisse") });
  for (const [coupure, qte] of Object.entries(v.coupures)) {
    const valeur = Number(coupure);
    const texte = (qte ?? "").trim();
    if (!COUPURES.includes(valeur)) {
      ctx.addIssue({ code: "custom", path: ["coupures"], message: t("tresorerie.arretes.err_coupure", { coupure }) });
    } else if (texte !== "" && (!/^\d+$/.test(texte))) {
      ctx.addIssue({ code: "custom", path: ["coupures"], message: t("tresorerie.arretes.err_qte", { montant: Number(valeur).toLocaleString("fr-FR") }) });
    }
  }
});
type ArreteForm = z.infer<ReturnType<typeof schemaArreteTraduction>>;

const schemaRemiseLieeTraduction = (t: (c: string) => string) => z.object({
  montant: z.string(),
  reference_bordereau: z.string().trim().min(1, t("tresorerie.arretes.err_bordereau")).max(100, t("tresorerie.arretes.err_max")),
  modes: z.enum(["ESPECES", "CHEQUE", "CHEQUE,ESPECES"]),
}).superRefine((v, ctx) => {
  const m = versNombre(v.montant);
  if (!Number.isFinite(m) || Math.round(m * 100) <= 0) {
    ctx.addIssue({ code: "custom", path: ["montant"], message: t("tresorerie.arretes.err_montant") });
  }
});
type RemiseLieeForm = z.infer<ReturnType<typeof schemaRemiseLieeTraduction>>;

function coupuresVides(): Record<string, string> {
  return Object.fromEntries(COUPURES.map((c) => [String(c), ""]));
}

function comptageVersForm(comptage: Record<number, number>): Record<string, string> {
  const base = coupuresVides();
  for (const [coupure, qte] of Object.entries(comptage)) base[String(coupure)] = String(qte);
  return base;
}

function totalSaisi(coupures: Record<string, string>): number {
  return Object.entries(coupures ?? {}).reduce((t, [coupure, qte]) => {
    const q = /^\d+$/.test((qte ?? "").trim()) ? Number((qte ?? "").trim()) : 0;
    return t + Number(coupure) * q;
  }, 0);
}

function ArretesTab() {
  const { t } = useT();
  const { can } = useAuth();
  const liste = usePagedList<ArreteCaisse>("tresorerie/arretes", { ordering: "-date_arrete" });
  const crud = useCrud<ArreteCaisse, unknown>("tresorerie/arretes");
  const valider = useRecordAction("tresorerie/arretes", "valider", t("tresorerie.arretes.valider_ok"));
  const creerRemise = useCrud<RemiseBanque, unknown>("tresorerie/remises");
  const { data: caisses } = useOptions<Caisse>("tresorerie/caisses", {}, can("caisse.view"));

  const [edition, setEdition] = useState<{ item?: ArreteCaisse } | null>(null);
  const [aValider, setAValider] = useState<ArreteCaisse | null>(null);
  const [aRemettre, setARemettre] = useState<ArreteCaisse | null>(null);
  const [erreurServeur, setErreurServeur] = useState<string | null>(null);
  const [erreurRemise, setErreurRemise] = useState<string | null>(null);
  const [noteHeritee, setNoteHeritee] = useState<string | null>(null);

  const schema = useMemo(() => schemaArreteTraduction(t), [t]);
  const schemaRemise = useMemo(() => schemaRemiseLieeTraduction(t), [t]);
  const form = useForm<ArreteForm>({
    resolver: zodResolver(schema),
    defaultValues: { caisse: null, date_arrete: "", coupures: coupuresVides() },
  });

  const formRemise = useForm<RemiseLieeForm>({
    resolver: zodResolver(schemaRemise),
    defaultValues: { montant: "", reference_bordereau: "", modes: "ESPECES" },
  });

  useEffect(() => {
    if (!edition) return;
    setErreurServeur(null);
    const comptage = lireComptage(edition.item?.detail_billets ?? null);
    setNoteHeritee(
      edition.item?.detail_billets && comptage === null ? edition.item.detail_billets : null,
    );
    form.reset({
      caisse: edition.item?.caisse ?? (caisses?.length === 1 ? caisses[0].id_caisse : null),
      date_arrete: edition.item?.date_arrete ?? dateLocaleISO(),
      coupures: comptage ? comptageVersForm(comptage) : coupuresVides(),
    });
  }, [edition, caisses, form]);

  useEffect(() => {
    if (!aRemettre) return;
    setErreurRemise(null);
    formRemise.reset({
      montant: String(aRemettre.montant_compte ?? ""),
      reference_bordereau: "",
      modes: "ESPECES",
    });
  }, [aRemettre, formRemise]);

  const coupuresSuivies = form.watch("coupures");
  const caisseSuivie = form.watch("caisse");
  const totalCompte = useMemo(() => totalSaisi(coupuresSuivies), [coupuresSuivies]);
  const erreurCoupures = useMemo(() => {
    const e = form.formState.errors.coupures as { message?: unknown } | undefined;
    if (!e) return undefined;
    return typeof e.message === "string" ? e.message : t("tresorerie.arretes.err_qte_generique");
  }, [form.formState.errors.coupures]);
  const soldeCaisse = useMemo(
    () => caisses?.find((c) => c.id_caisse === caisseSuivie)?.solde_actuel ?? null,
    [caisses, caisseSuivie],
  );

  const enregistrer = form.handleSubmit(async (v) => {
    setErreurServeur(null);
    const utiles = Object.fromEntries(
      Object.entries(v.coupures).filter(([, qte]) => (qte ?? "").trim() !== "" && Number((qte ?? "").trim()) > 0)
        .map(([coupure, qte]) => [coupure, Number((qte ?? "").trim())]),
    );
    const body = {
      caisse: v.caisse,
      date_arrete: v.date_arrete,
      montant_compte: totalSaisi(v.coupures),
      detail_billets: Object.keys(utiles).length > 0 ? JSON.stringify(utiles) : null,
    };
    try {
      if (edition?.item) await crud.update.mutateAsync({ id: edition.item.id_arrete, body });
      else await crud.create.mutateAsync(body);
      setEdition(null);
    } catch (e) {
      setErreurServeur(applyServerErrors(e, form.setError, ["caisse", "date_arrete", "coupures"]));
    }
  });

  const enregistrerRemise = formRemise.handleSubmit(async (v) => {
    if (!aRemettre) return;
    setErreurRemise(null);
    try {
      await creerRemise.create.mutateAsync({
        caisse: aRemettre.caisse,
        montant: Math.round(versNombre(v.montant) * 100) / 100,
        reference_bordereau: v.reference_bordereau.trim(),
        modes: v.modes,
        arrete: aRemettre.id_arrete,
      });
      setARemettre(null);
    } catch (e) {
      setErreurRemise(applyServerErrors(e, formRemise.setError, ["montant", "reference_bordereau", "modes"]));
    }
  });

  async function confirmerValidation() {
    if (!aValider) return;
    try {
      await valider.mutateAsync({ id: aValider.id_arrete });
    } catch {
      /* erreur affichée en notification */
    }
    setAValider(null);
  }

  const colonnes: Column<ArreteCaisse>[] = [
    { key: "date", header: "tresorerie.arretes.col_journee", sortKey: "date_arrete", cell: (a) => formatDate(a.date_arrete) },
    { key: "caisse", header: "tresorerie.arretes.col_caisse", cell: (a) => a.code_caisse },
    { key: "entrees", header: "tresorerie.arretes.col_entrees", className: "text-right tabular-nums", cell: (a) => formatAr(a.total_entrees) },
    { key: "sorties", header: "tresorerie.arretes.col_sorties", className: "text-right tabular-nums", cell: (a) => formatAr(a.total_sorties) },
    { key: "theorique", header: "tresorerie.arretes.col_theorique", className: "text-right tabular-nums", cell: (a) => formatAr(a.solde_theorique) },
    { key: "compte", header: "tresorerie.arretes.col_compte", className: "text-right tabular-nums font-semibold", cell: (a) => formatAr(a.montant_compte) },
    {
      key: "ecart", header: "tresorerie.arretes.col_ecart", className: "text-right tabular-nums font-semibold",
      cell: (a) => (
        <span className={Number(a.ecart) === 0 ? "text-green-700" : "text-destructive"}>
          {formatAr(a.ecart)}
        </span>
      ),
    },
    { key: "statut", header: "tresorerie.arretes.col_statut", cell: (a) => <StatusBadge statut={a.statut} /> },
    {
      key: "remise", header: "tresorerie.arretes.col_remise",
      cell: (a) =>
        (a.remises ?? []).length > 0 ? (
          <span className="inline-flex flex-wrap items-center gap-1">
            {a.remises.map((r) => (
              <span key={r.id_remise} className="inline-flex items-center gap-1">
                <code className="text-xs">{r.reference_bordereau}</code>
                <StatusBadge statut={r.statut} />
              </span>
            ))}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <FilterSelect
            label={t("tresorerie.arretes.filtre_caisse")} className="w-48"
            options={(caisses ?? []).map((c) => ({ value: String(c.id_caisse), label: c.code_caisse }))}
            value={String(liste.filters.caisse ?? "")}
            onChange={(v) => liste.setFilter("caisse", v)}
          />
          <FilterSelect
            label={t("tresorerie.arretes.filtre_statut")} className="w-44"
            options={[{ value: "BROUILLON", label: t("tresorerie.arretes.opt_brouillons") }, { value: "VALIDE", label: t("tresorerie.arretes.opt_valides") }]}
            value={String(liste.filters.statut ?? "")}
            onChange={(v) => liste.setFilter("statut", v)}
          />
        </div>
        {(can("arrete_caisse.create")) && (
          <Button onClick={() => setEdition({})}>
            <Plus className="mr-2 h-4 w-4" /> {t("tresorerie.arretes.nouveau")}
          </Button>
        )}
      </div>

      <DataTable
        columns={colonnes}
        data={liste.query.data}
        isLoading={liste.query.isLoading}
        isFetching={liste.query.isFetching}
        error={liste.query.error}
        rowKey={(a) => a.id_arrete}
        page={liste.page} pageSize={liste.pageSize} onPageChange={liste.setPage}
        ordering={liste.ordering} onOrderingChange={liste.setOrdering}
        emptyMessage="tresorerie.arretes.vide"
        actions={(a) => (
          <>
            {a.statut === "BROUILLON" && can("arrete_caisse.update") && (
              <Button variant="ghost" size="icon" title={t("tresorerie.arretes.action_modifier")} aria-label={t("tresorerie.arretes.action_modifier")} onClick={() => setEdition({ item: a })}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {a.statut === "BROUILLON" && can("arrete_caisse.valider") && (
              <Button variant="ghost" size="icon" title={t("tresorerie.arretes.action_valider")} aria-label={t("tresorerie.arretes.action_valider")} onClick={() => setAValider(a)}>
                <BookmarkCheck className="h-4 w-4 text-green-700" />
              </Button>
            )}
            {a.statut === "VALIDE" && can("remise_banque.create") && (
              <Button variant="ghost" size="icon" title={t("tresorerie.arretes.action_remettre")} aria-label={t("tresorerie.arretes.action_remettre")} onClick={() => setARemettre(a)}>
                <Landmark className="h-4 w-4 text-green-700" />
              </Button>
            )}
          </>
        )}
      />

      <FormDialog
        open={edition !== null}
        onOpenChange={(o) => !o && setEdition(null)}
        title={edition?.item ? t("tresorerie.arretes.edit_titre") : t("tresorerie.arretes.new_titre")}
        description={t("tresorerie.arretes.dialog_desc")}
        onSubmit={enregistrer}
        submitting={form.formState.isSubmitting}
        error={erreurServeur}
        submitLabel={t("tresorerie.arretes.submit")}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("tresorerie.arretes.champ_caisse")} error={form.formState.errors.caisse?.message}>
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
                  placeholder={t("tresorerie.arretes.choisir_caisse")}
                />
              )}
            />
          </Field>
          <Field label={t("tresorerie.arretes.champ_journee")} htmlFor="date_arrete" error={form.formState.errors.date_arrete?.message}>
            <Input id="date_arrete" type="date" {...form.register("date_arrete")} />
          </Field>
        </div>
        <Field label={t("tresorerie.arretes.champ_comptage")} error={erreurCoupures}
          hint={t("tresorerie.arretes.hint_comptage")}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {COUPURES.map((valeur) => (
              <label key={valeur} className="flex items-center gap-2 rounded-lg border px-2 py-1.5 text-sm">
                <span className="min-w-16 flex-1 text-right tabular-nums text-muted-foreground">
                  {valeur.toLocaleString("fr-FR")} Ar
                </span>
                <span className="text-muted-foreground">×</span>
                <Input
                  inputMode="numeric" placeholder="0" className="h-8 w-20 text-right tabular-nums"
                  aria-label={t("tresorerie.arretes.qte_pour", { valeur: valeur.toLocaleString("fr-FR") })}
                  {...form.register(`coupures.${String(valeur) as `${number}`}`)}
                />
              </label>
            ))}
          </div>
        </Field>
        {noteHeritee && (
          <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
            {t("tresorerie.arretes.note_heritee", { note: noteHeritee })}
          </p>
        )}
        <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-3 text-center">
          <div>
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{t("tresorerie.arretes.stat_compte")}</p>
            <p className="text-base font-semibold tabular-nums">{formatAr(totalCompte)}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{t("tresorerie.arretes.stat_solde")}</p>
            <p className="text-base font-semibold tabular-nums">{soldeCaisse === null ? "—" : formatAr(soldeCaisse)}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{t("tresorerie.arretes.stat_ecart")}</p>
            <p className={cn("text-base font-semibold tabular-nums", soldeCaisse !== null && totalCompte - Number(soldeCaisse) !== 0 ? "text-destructive" : "text-green-700")}>
              {soldeCaisse === null ? "—" : formatAr(totalCompte - Number(soldeCaisse))}
            </p>
          </div>
        </div>
      </FormDialog>

      <FormDialog
        open={aRemettre !== null}
        onOpenChange={(o) => !o && setARemettre(null)}
        title={t("tresorerie.arretes.remise_titre", { date: aRemettre ? formatDate(aRemettre.date_arrete) : "" })}
        description={t("tresorerie.arretes.remise_desc", { caisse: aRemettre?.code_caisse ?? "", montant: aRemettre ? formatAr(aRemettre.montant_compte) : "" })}
        onSubmit={enregistrerRemise}
        submitting={formRemise.formState.isSubmitting}
        error={erreurRemise}
        submitLabel={t("tresorerie.arretes.remise_submit")}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("tresorerie.arretes.champ_montant")} htmlFor="montant_remise_liee" error={formRemise.formState.errors.montant?.message}>
            <Input id="montant_remise_liee" inputMode="decimal" autoFocus {...formRemise.register("montant")} />
          </Field>
          <Field label={t("tresorerie.arretes.champ_contenu")} error={formRemise.formState.errors.modes?.message}>
            <Controller
              control={formRemise.control}
              name="modes"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} items={{ ESPECES: t("tresorerie.modes.especes"), CHEQUE: t("tresorerie.modes.cheques"), "CHEQUE,ESPECES": t("tresorerie.modes.mixte") }}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ESPECES">{t("tresorerie.modes.especes")}</SelectItem>
                    <SelectItem value="CHEQUE">{t("tresorerie.modes.cheques")}</SelectItem>
                    <SelectItem value="CHEQUE,ESPECES">{t("tresorerie.modes.mixte")}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </div>
        <Field label={t("tresorerie.arretes.champ_bordereau")} htmlFor="reference_bordereau_liee" error={formRemise.formState.errors.reference_bordereau?.message}>
          <Input id="reference_bordereau_liee" {...formRemise.register("reference_bordereau")} placeholder={t("tresorerie.arretes.ph_bordereau")} />
        </Field>
      </FormDialog>

      <ConfirmDialog
        open={aValider !== null}
        onOpenChange={(o) => !o && setAValider(null)}
        title={t("tresorerie.arretes.valider_titre")}
        description={t("tresorerie.arretes.valider_desc", { date: aValider ? formatDate(aValider.date_arrete) : "", caisse: aValider?.code_caisse ?? "" })}
        confirmLabel={t("tresorerie.arretes.valider_btn")}
        loading={valider.isPending}
        onConfirm={confirmerValidation}
      />
    </div>
  );
}

// ------------------------------------------------------- Remises en banque
const schemaRemiseTraduction = (t: (c: string) => string) => z.object({
  caisse: z.number().nullable(),
  montant: z.string(),
  reference_bordereau: z.string().trim().min(1, t("tresorerie.remises.err_bordereau")).max(100, t("tresorerie.remises.err_max")),
  modes: z.enum(["ESPECES", "CHEQUE", "CHEQUE,ESPECES"]),
}).superRefine((v, ctx) => {
  if (v.caisse === null) ctx.addIssue({ code: "custom", path: ["caisse"], message: t("tresorerie.remises.err_caisse") });
  const m = versNombre(v.montant);
  if (!Number.isFinite(m) || Math.round(m * 100) <= 0) {
    ctx.addIssue({ code: "custom", path: ["montant"], message: t("tresorerie.remises.err_montant") });
  }
});
type RemiseForm = z.infer<ReturnType<typeof schemaRemiseTraduction>>;

const CLES_MODES_REMISE = [
  { value: "ESPECES", cle: "tresorerie.modes.especes" },
  { value: "CHEQUE", cle: "tresorerie.modes.cheques" },
  { value: "CHEQUE,ESPECES", cle: "tresorerie.modes.mixte" },
];

function RemisesTab() {
  const { t } = useT();
  const { can } = useAuth();
  const liste = usePagedList<RemiseBanque>("tresorerie/remises", { ordering: "-date_remise" });
  const crud = useCrud<RemiseBanque, unknown>("tresorerie/remises");
  const remettre = useRecordAction("tresorerie/remises", "remettre", t("tresorerie.remises.ok"));
  const { data: caisses } = useOptions<Caisse>("tresorerie/caisses", {}, can("caisse.view"));

  const [ouvert, setOuvert] = useState(false);
  const [aRemettre, setARemettre] = useState<RemiseBanque | null>(null);
  const [erreurServeur, setErreurServeur] = useState<string | null>(null);

  const schema = useMemo(() => schemaRemiseTraduction(t), [t]);
  const form = useForm<RemiseForm>({
    resolver: zodResolver(schema),
    defaultValues: { caisse: null, montant: "", reference_bordereau: "", modes: "ESPECES" },
  });

  useEffect(() => {
    if (!ouvert) return;
    setErreurServeur(null);
    form.reset({
      caisse: caisses?.length === 1 ? caisses[0].id_caisse : null,
      montant: "", reference_bordereau: "", modes: "ESPECES",
    });
  }, [ouvert, caisses, form]);

  const enregistrer = form.handleSubmit(async (v) => {
    setErreurServeur(null);
    try {
      await crud.create.mutateAsync({
        caisse: v.caisse,
        montant: Math.round(versNombre(v.montant) * 100) / 100,
        reference_bordereau: v.reference_bordereau,
        modes: v.modes,
      });
      setOuvert(false);
    } catch (e) {
      setErreurServeur(applyServerErrors(e, form.setError, ["caisse", "montant", "reference_bordereau", "modes"]));
    }
  });

  async function confirmerRemise() {
    if (!aRemettre) return;
    try {
      await remettre.mutateAsync({ id: aRemettre.id_remise });
    } catch {
      /* erreur affichée en notification */
    }
    setARemettre(null);
  }

  const colonnes: Column<RemiseBanque>[] = [
    { key: "date", header: "tresorerie.remises.col_date", sortKey: "date_remise", cell: (r) => formatDateTime(r.date_remise) },
    { key: "caisse", header: "tresorerie.remises.col_caisse", cell: (r) => r.code_caisse },
    { key: "bordereau", header: "tresorerie.remises.col_bordereau", cell: (r) => <code className="text-xs">{r.reference_bordereau}</code> },
    { key: "modes", header: "tresorerie.remises.col_contenu", cell: (r) => r.modes.split(",").join(" + ") },
    { key: "montant", header: "tresorerie.remises.col_montant", className: "text-right tabular-nums font-semibold", cell: (r) => formatAr(r.montant) },
    {
      key: "arrete", header: "tresorerie.remises.col_arrete",
      cell: (r) => (r.date_arrete ? formatDate(r.date_arrete) : <span className="text-muted-foreground">—</span>),
    },
    { key: "statut", header: "tresorerie.remises.col_statut", cell: (r) => <StatusBadge statut={r.statut} /> },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <FilterSelect
            label={t("tresorerie.remises.filtre_caisse")} className="w-48"
            options={(caisses ?? []).map((c) => ({ value: String(c.id_caisse), label: c.code_caisse }))}
            value={String(liste.filters.caisse ?? "")}
            onChange={(v) => liste.setFilter("caisse", v)}
          />
          <FilterSelect
            label={t("tresorerie.remises.filtre_statut")} className="w-44"
            options={[{ value: "PREPAREE", label: t("tresorerie.remises.opt_preparees") }, { value: "REMISE", label: t("tresorerie.remises.opt_remises") }]}
            value={String(liste.filters.statut ?? "")}
            onChange={(v) => liste.setFilter("statut", v)}
          />
        </div>
        {can("remise_banque.create") && (
          <Button onClick={() => setOuvert(true)}>
            <Plus className="mr-2 h-4 w-4" /> {t("tresorerie.remises.nouveau")}
          </Button>
        )}
      </div>

      <DataTable
        columns={colonnes}
        data={liste.query.data}
        isLoading={liste.query.isLoading}
        isFetching={liste.query.isFetching}
        error={liste.query.error}
        rowKey={(r) => r.id_remise}
        page={liste.page} pageSize={liste.pageSize} onPageChange={liste.setPage}
        ordering={liste.ordering} onOrderingChange={liste.setOrdering}
        emptyMessage="tresorerie.remises.vide"
        actions={(r) => (
          <>
            {r.statut === "PREPAREE" && can("remise_banque.remettre") && (
              <Button variant="ghost" size="icon" title={t("tresorerie.remises.action_executer")} aria-label={t("tresorerie.remises.action_executer")} onClick={() => setARemettre(r)}>
                <Landmark className="h-4 w-4 text-green-700" />
              </Button>
            )}
          </>
        )}
      />

      <FormDialog
        open={ouvert}
        onOpenChange={setOuvert}
        title={t("tresorerie.remises.dialog_titre")}
        description={t("tresorerie.remises.dialog_desc")}
        onSubmit={enregistrer}
        submitting={form.formState.isSubmitting}
        error={erreurServeur}
        submitLabel={t("tresorerie.remises.submit")}
      >
        <Field label={t("tresorerie.remises.champ_caisse")} error={form.formState.errors.caisse?.message}>
          <Controller
            control={form.control}
            name="caisse"
            render={({ field }) => (
              <RemoteSelect<Caisse>
                path="tresorerie/caisses"
                value={field.value}
                onChange={field.onChange}
                getValue={(c) => c.id_caisse}
                getLabel={(c) => `${c.code_caisse} — ${c.libelle_caisse} (${formatAr(c.solde_actuel)})`}
                placeholder={t("tresorerie.remises.choisir_caisse")}
              />
            )}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("tresorerie.remises.champ_montant")} htmlFor="montant_remise" error={form.formState.errors.montant?.message}>
            <Input id="montant_remise" inputMode="decimal" autoFocus {...form.register("montant")} />
          </Field>
          <Field label={t("tresorerie.remises.champ_contenu")} error={form.formState.errors.modes?.message}>
            <Controller
              control={form.control}
              name="modes"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} items={{ ESPECES: t("tresorerie.modes.especes"), CHEQUE: t("tresorerie.modes.cheques"), "CHEQUE,ESPECES": t("tresorerie.modes.mixte") }}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CLES_MODES_REMISE.map((m) => <SelectItem key={m.value} value={m.value}>{t(m.cle)}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </div>
        <Field label={t("tresorerie.remises.champ_bordereau")} htmlFor="reference_bordereau" error={form.formState.errors.reference_bordereau?.message}>
          <Input id="reference_bordereau" {...form.register("reference_bordereau")} placeholder={t("tresorerie.arretes.ph_bordereau")} />
        </Field>
      </FormDialog>

      <ConfirmDialog
        open={aRemettre !== null}
        onOpenChange={(o) => !o && setARemettre(null)}
        title={t("tresorerie.remises.confirmer_titre")}
        description={t("tresorerie.remises.confirmer_desc", { ref: aRemettre?.reference_bordereau ?? "", montant: aRemettre ? formatAr(aRemettre.montant) : "", caisse: aRemettre?.code_caisse ?? "" })}
        confirmLabel={t("tresorerie.remises.confirmer_btn")}
        loading={remettre.isPending}
        onConfirm={confirmerRemise}
      />
    </div>
  );
}