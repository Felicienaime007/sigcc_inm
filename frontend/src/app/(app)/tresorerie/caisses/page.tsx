"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { Field } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { usePagedList } from "@/hooks/use-paged-list";
import { useAuth } from "@/lib/auth-context";
import { versNombre } from "@/lib/clients";
import { applyServerErrors } from "@/lib/form-utils";
import { formatAr, formatDateTime } from "@/lib/format";
import { useCrud, useOptions } from "@/lib/resource";
import { cn } from "@/lib/utils";
import type { Caisse, EcritureCaisse } from "@/types/tresorie";

export default function CaissesPage() {
  return (
    <RequirePrivilege privilege={["caisse.view", "livre_caisse.view"]}>
      <Contenu />
    </RequirePrivilege>
  );
}

function Contenu() {
  const { can } = useAuth();
  const onglets = [
    can("caisse.view") && { id: "caisses", label: "Caisses" },
    can("livre_caisse.view") && { id: "journal", label: "Livre de caisse" },
  ].filter(Boolean) as { id: string; label: string }[];
  const [choix, setChoix] = useState<string | null>(null);
  const actif = onglets.find((o) => o.id === choix)?.id ?? onglets[0]?.id;
  if (!actif) return null;

  return (
    <div>
      <PageHeader
        title="Caisses"
        description="Soldes des caisses et livre de caisse. Chaque encaissement alimente le livre automatiquement."
      />
      <Tabs value={actif} onValueChange={setChoix}>
        <TabsList>
          {onglets.map((o) => <TabsTrigger key={o.id} value={o.id}>{o.label}</TabsTrigger>)}
        </TabsList>
        <TabsContent value="caisses" className="mt-6"><CaissesTab /></TabsContent>
        <TabsContent value="journal" className="mt-6"><JournalTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ----------------------------------------------------------------- Caisses
const schemaCaisse = z.object({
  code_caisse: z.string().trim().min(1, "Le code est obligatoire.").max(20, "20 caractères maximum."),
  libelle_caisse: z.string().trim().min(1, "Le libellé est obligatoire.").max(100, "100 caractères maximum."),
});
type CaisseForm = z.infer<typeof schemaCaisse>;
type EditionCaisse = { mode: "create" } | { mode: "edit"; item: Caisse } | null;

function CaissesTab() {
  const { can } = useAuth();
  const liste = usePagedList<Caisse>("tresorerie/caisses", { pageSize: 50, ordering: "code_caisse" });
  const crud = useCrud<Caisse, CaisseForm>("tresorerie/caisses");

  const [edition, setEdition] = useState<EditionCaisse>(null);
  const [aSupprimer, setASupprimer] = useState<Caisse | null>(null);
  const [erreurServeur, setErreurServeur] = useState<string | null>(null);

  const form = useForm<CaisseForm>({
    resolver: zodResolver(schemaCaisse),
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
    { key: "code", header: "Code", sortKey: "code_caisse", cell: (c) => <code className="text-xs">{c.code_caisse}</code> },
    { key: "libelle", header: "Caisse", sortKey: "libelle_caisse", cell: (c) => <span className="font-medium">{c.libelle_caisse}</span> },
    {
      key: "solde", header: "Solde actuel", className: "text-right tabular-nums font-semibold",
      cell: (c) => formatAr(c.solde_actuel),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Card>
          <CardContent className="px-5 py-3">
            <p className="text-xs text-muted-foreground">Solde total des caisses</p>
            <p className="text-2xl font-semibold tabular-nums">{formatAr(total)}</p>
          </CardContent>
        </Card>
        {can("caisse.create") && (
          <Button onClick={() => setEdition({ mode: "create" })}>
            <Plus className="mr-2 h-4 w-4" /> Nouvelle caisse
          </Button>
        )}
      </div>

      <SearchInput value={liste.searchInput} onChange={liste.setSearchInput} placeholder="Code ou libellé…" />

      <DataTable
        columns={colonnes}
        data={liste.query.data}
        isLoading={liste.query.isLoading}
        isFetching={liste.query.isFetching}
        error={liste.query.error}
        rowKey={(c) => c.id_caisse}
        page={liste.page} pageSize={liste.pageSize} onPageChange={liste.setPage}
        ordering={liste.ordering} onOrderingChange={liste.setOrdering}
        emptyMessage="Aucune caisse."
        actions={(c) => (
          <>
            {can("caisse.update") && (
              <Button variant="ghost" size="icon" title="Modifier" onClick={() => setEdition({ mode: "edit", item: c })}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {can("caisse.delete") && (
              <Button variant="ghost" size="icon" title="Supprimer" onClick={() => setASupprimer(c)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </>
        )}
      />

      <FormDialog
        open={edition !== null}
        onOpenChange={(o) => !o && setEdition(null)}
        title={edition?.mode === "edit" ? "Modifier la caisse" : "Nouvelle caisse"}
        description="Le solde ne se saisit pas : il évolue uniquement par les encaissements et les opérations du livre de caisse."
        onSubmit={enregistrer}
        submitting={form.formState.isSubmitting}
        error={erreurServeur}
      >
        <Field label="Code" htmlFor="code_caisse" error={form.formState.errors.code_caisse?.message} hint="Unique (ex. CAISSE-01).">
          <Input id="code_caisse" autoFocus {...form.register("code_caisse")} />
        </Field>
        <Field label="Libellé" htmlFor="libelle_caisse" error={form.formState.errors.libelle_caisse?.message}>
          <Input id="libelle_caisse" {...form.register("libelle_caisse")} />
        </Field>
      </FormDialog>

      <ConfirmDialog
        open={aSupprimer !== null}
        onOpenChange={(o) => !o && setASupprimer(null)}
        title="Supprimer la caisse ?"
        description={`« ${aSupprimer?.libelle_caisse ?? ""} » sera supprimée. Impossible si elle a des quittances ou des écritures.`}
        confirmLabel="Supprimer"
        destructive
        loading={crud.remove.isPending}
        onConfirm={supprimer}
      />
    </div>
  );
}

// -------------------------------------------------------------- Livre de caisse
const schemaOperation = z.object({
  caisse: z.number().nullable(),
  type_operation: z.enum(["ENTREE", "SORTIE"]),
  montant_op: z.string(),
  reference: z.string().trim().min(1, "Le motif est obligatoire.").max(100, "100 caractères maximum."),
}).superRefine((v, ctx) => {
  if (v.caisse === null) ctx.addIssue({ code: "custom", path: ["caisse"], message: "La caisse est obligatoire." });
  const m = versNombre(v.montant_op);
  if (!Number.isFinite(m) || Math.round(m * 100) <= 0) {
    ctx.addIssue({ code: "custom", path: ["montant_op"], message: "Le montant doit être supérieur à 0." });
  }
});
type OperationForm = z.infer<typeof schemaOperation>;

function JournalTab() {
  const { can } = useAuth();
  const liste = usePagedList<EcritureCaisse>("tresorerie/livre-caisse", { ordering: "-date_operation" });
  const crud = useCrud<EcritureCaisse, unknown>("tresorerie/livre-caisse");
  const { data: caisses } = useOptions<Caisse>("tresorerie/caisses", {}, can("caisse.view"));

  const [ouvert, setOuvert] = useState(false);
  const [erreurServeur, setErreurServeur] = useState<string | null>(null);

  const form = useForm<OperationForm>({
    resolver: zodResolver(schemaOperation),
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
    { key: "date", header: "Date", sortKey: "date_operation", cell: (e) => formatDateTime(e.date_operation) },
    { key: "caisse", header: "Caisse", cell: (e) => e.code_caisse },
    {
      key: "type", header: "Opération",
      cell: (e) => (
        <span className={cn(
          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
          e.type_operation === "ENTREE" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800",
        )}>
          {e.type_operation === "ENTREE" ? "Entrée" : "Sortie"}
        </span>
      ),
    },
    {
      key: "montant", header: "Montant", className: "text-right tabular-nums", sortKey: "montant_op",
      cell: (e) => (
        <span className={e.type_operation === "ENTREE" ? "text-green-700" : "text-amber-700"}>
          {e.type_operation === "ENTREE" ? "+" : "−"} {formatAr(e.montant_op)}
        </span>
      ),
    },
    {
      key: "ref", header: "Référence",
      cell: (e) => (e.num_facture ? `Encaissement ${e.num_facture}` : (e.reference ?? "—")),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={liste.searchInput} onChange={liste.setSearchInput} placeholder="Référence ou n° de facture…" />
          <FilterSelect
            label="Caisse" className="w-48"
            options={(caisses ?? []).map((c) => ({ value: String(c.id_caisse), label: c.code_caisse }))}
            value={String(liste.filters.caisse ?? "")}
            onChange={(v) => liste.setFilter("caisse", v)}
          />
          <FilterSelect
            label="Opération" className="w-44"
            options={[{ value: "ENTREE", label: "Entrées" }, { value: "SORTIE", label: "Sorties" }]}
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
            <Plus className="mr-2 h-4 w-4" /> Opération manuelle
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
        emptyMessage="Aucune écriture."
      />

      <FormDialog
        open={ouvert}
        onOpenChange={setOuvert}
        title="Opération manuelle de caisse"
        description="Versement en banque ou remise au Trésor (sortie), fond de caisse (entrée). Les encaissements de factures sont enregistrés automatiquement : ne les saisissez pas ici."
        onSubmit={enregistrer}
        submitting={form.formState.isSubmitting}
        error={erreurServeur}
        submitLabel="Enregistrer l'opération"
      >
        <Field label="Caisse" error={form.formState.errors.caisse?.message}>
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
                placeholder="Choisir la caisse…"
              />
            )}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type d'opération" error={form.formState.errors.type_operation?.message}>
            <Controller
              control={form.control}
              name="type_operation"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SORTIE">Sortie (versement, remise)</SelectItem>
                    <SelectItem value="ENTREE">Entrée (fond de caisse)</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Montant (Ar)" htmlFor="montant_op" error={form.formState.errors.montant_op?.message}>
            <Input id="montant_op" inputMode="decimal" {...form.register("montant_op")} />
          </Field>
        </div>
        <Field label="Motif / référence" htmlFor="reference" error={form.formState.errors.reference?.message}
          hint="Ex. « Versement banque BFV du 12/03 », « Fond de caisse initial ».">
          <Input id="reference" {...form.register("reference")} />
        </Field>
      </FormDialog>
    </div>
  );
}