"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RequirePrivilege } from "@/components/can";
import { PageHeader } from "@/components/page-header";
import { DataTable, type Column } from "@/components/data/data-table";
import { FilterSelect } from "@/components/data/filter-select";
import { RemoteSelect } from "@/components/data/remote-select";
import { SearchInput } from "@/components/data/search-input";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { Field } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { usePagedList } from "@/hooks/use-paged-list";
import { useAuth } from "@/lib/auth-context";
import { applyServerErrors } from "@/lib/form-utils";
import { formatNombre } from "@/lib/format";
import { useCrud, useOptions } from "@/lib/resource";
import type { EmplacementStock, Magasin } from "@/types/stock";

export default function MagasinsPage() {
  return (
    <RequirePrivilege privilege="magasin.view">
      <Contenu />
    </RequirePrivilege>
  );
}

function Contenu() {
  const { can } = useAuth();
  const [onglet, setOnglet] = useState("magasins");
  return (
    <div>
      <PageHeader title="Magasins & emplacements" description="Dépôts de l'Imprimerie Nationale et rayonnages (allée et étagère)." />
      <Tabs value={onglet} onValueChange={setOnglet}>
        <TabsList>
          <TabsTrigger value="magasins">Magasins</TabsTrigger>
          {can("emplacement.view") && <TabsTrigger value="emplacements">Emplacements</TabsTrigger>}
        </TabsList>
        <TabsContent value="magasins" className="mt-6"><MagasinsTab /></TabsContent>
        <TabsContent value="emplacements" className="mt-6"><EmplacementsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ------------------------------------------------------------------ Magasins
const schemaMagasin = z.object({
  nom_magasin: z.string().trim().min(1, "Le nom est obligatoire.").max(100, "100 caractères maximum."),
  code_depot: z.string().trim().min(1, "Le code est obligatoire.").max(20, "20 caractères maximum."),
});
type MagasinForm = z.infer<typeof schemaMagasin>;
type EditionMagasin = { mode: "create" } | { mode: "edit"; item: Magasin } | null;

function MagasinsTab() {
  const { can } = useAuth();
  const liste = usePagedList<Magasin>("stock/magasins", { ordering: "code_depot" });
  const crud = useCrud<Magasin, MagasinForm>("stock/magasins");
  const [edition, setEdition] = useState<EditionMagasin>(null);
  const [aSupprimer, setASupprimer] = useState<Magasin | null>(null);
  const [erreurServeur, setErreurServeur] = useState<string | null>(null);

  const form = useForm<MagasinForm>({ resolver: zodResolver(schemaMagasin), defaultValues: { nom_magasin: "", code_depot: "" } });

  useEffect(() => {
    if (!edition) return;
    setErreurServeur(null);
    form.reset(edition.mode === "edit"
      ? { nom_magasin: edition.item.nom_magasin, code_depot: edition.item.code_depot }
      : { nom_magasin: "", code_depot: "" });
  }, [edition, form]);

  const enregistrer = form.handleSubmit(async (v) => {
    setErreurServeur(null);
    try {
      if (edition?.mode === "edit") await crud.update.mutateAsync({ id: edition.item.id_magasin, body: v });
      else await crud.create.mutateAsync(v);
      setEdition(null);
    } catch (e) {
      setErreurServeur(applyServerErrors(e, form.setError, ["nom_magasin", "code_depot"]));
    }
  });

  async function supprimer() {
    if (!aSupprimer) return;
    try {
      await crud.remove.mutateAsync(aSupprimer.id_magasin);
    } catch {
      /* 409 : le magasin a des emplacements */
    }
    setASupprimer(null);
  }

  const colonnes: Column<Magasin>[] = [
    { key: "code", header: "Code", sortKey: "code_depot", cell: (m) => <code className="text-xs">{m.code_depot}</code> },
    { key: "nom", header: "Magasin", sortKey: "nom_magasin", cell: (m) => <span className="font-medium">{m.nom_magasin}</span> },
    { key: "nb", header: "Emplacements", sortKey: "nb_emplacements", className: "text-right tabular-nums", cell: (m) => formatNombre(m.nb_emplacements) },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SearchInput value={liste.searchInput} onChange={liste.setSearchInput} placeholder="Nom ou code…" />
        {can("magasin.create") && (
          <Button onClick={() => setEdition({ mode: "create" })}>
            <Plus className="mr-2 h-4 w-4" /> Nouveau magasin
          </Button>
        )}
      </div>

      <DataTable
        columns={colonnes}
        data={liste.query.data}
        isLoading={liste.query.isLoading}
        isFetching={liste.query.isFetching}
        error={liste.query.error}
        rowKey={(m) => m.id_magasin}
        page={liste.page} pageSize={liste.pageSize} onPageChange={liste.setPage}
        ordering={liste.ordering} onOrderingChange={liste.setOrdering}
        emptyMessage="Aucun magasin."
        actions={(m) => (
          <>
            {can("magasin.update") && (
              <Button variant="ghost" size="icon" title="Modifier" onClick={() => setEdition({ mode: "edit", item: m })}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {can("magasin.delete") && (
              <Button variant="ghost" size="icon" title="Supprimer" onClick={() => setASupprimer(m)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </>
        )}
      />

      <FormDialog
        open={edition !== null}
        onOpenChange={(o) => !o && setEdition(null)}
        title={edition?.mode === "edit" ? "Modifier le magasin" : "Nouveau magasin"}
        onSubmit={enregistrer}
        submitting={form.formState.isSubmitting}
        error={erreurServeur}
      >
        <Field label="Code du dépôt" htmlFor="code_depot" error={form.formState.errors.code_depot?.message} hint="Unique (ex. MAG-01).">
          <Input id="code_depot" autoFocus {...form.register("code_depot")} />
        </Field>
        <Field label="Nom du magasin" htmlFor="nom_magasin" error={form.formState.errors.nom_magasin?.message}>
          <Input id="nom_magasin" {...form.register("nom_magasin")} />
        </Field>
      </FormDialog>

      <ConfirmDialog
        open={aSupprimer !== null}
        onOpenChange={(o) => !o && setASupprimer(null)}
        title="Supprimer le magasin ?"
        description={`« ${aSupprimer?.nom_magasin ?? ""} » sera supprimé. Impossible s'il a des emplacements.`}
        confirmLabel="Supprimer"
        destructive
        loading={crud.remove.isPending}
        onConfirm={supprimer}
      />
    </div>
  );
}

// ---------------------------------------------------------------- Emplacements
const schemaEmpl = z
  .object({
    magasin: z.number().nullable(),
    code_allee: z.string().trim().min(1, "L'allée est obligatoire.").max(10, "10 caractères maximum."),
    code_etagere: z.string().trim().min(1, "L'étagère est obligatoire.").max(10, "10 caractères maximum."),
  })
  .superRefine((v, ctx) => {
    if (v.magasin === null) ctx.addIssue({ code: "custom", path: ["magasin"], message: "Le magasin est obligatoire." });
  });
type EmplForm = z.infer<typeof schemaEmpl>;
type EditionEmpl = { mode: "create" } | { mode: "edit"; item: EmplacementStock } | null;

function EmplacementsTab() {
  const { can } = useAuth();
  const liste = usePagedList<EmplacementStock>("stock/emplacements", { ordering: "magasin__code_depot" });
  const crud = useCrud<EmplacementStock, EmplForm>("stock/emplacements");
  const magasins = useOptions<Magasin>("stock/magasins");
  const [edition, setEdition] = useState<EditionEmpl>(null);
  const [aSupprimer, setASupprimer] = useState<EmplacementStock | null>(null);
  const [erreurServeur, setErreurServeur] = useState<string | null>(null);

  const form = useForm<EmplForm>({
    resolver: zodResolver(schemaEmpl),
    defaultValues: { magasin: null, code_allee: "", code_etagere: "" },
  });

  useEffect(() => {
    if (!edition) return;
    setErreurServeur(null);
    form.reset(edition.mode === "edit"
      ? { magasin: edition.item.magasin, code_allee: edition.item.code_allee, code_etagere: edition.item.code_etagere }
      : { magasin: null, code_allee: "", code_etagere: "" });
  }, [edition, form]);

  const enregistrer = form.handleSubmit(async (v) => {
    setErreurServeur(null);
    try {
      if (edition?.mode === "edit") await crud.update.mutateAsync({ id: edition.item.id_emplacement, body: v });
      else await crud.create.mutateAsync(v);
      setEdition(null);
    } catch (e) {
      setErreurServeur(applyServerErrors(e, form.setError, ["magasin", "code_allee", "code_etagere"]));
    }
  });

  async function supprimer() {
    if (!aSupprimer) return;
    try {
      await crud.remove.mutateAsync(aSupprimer.id_emplacement);
    } catch {
      /* 409 : l'emplacement contient ou a contenu du stock */
    }
    setASupprimer(null);
  }

  const colonnes: Column<EmplacementStock>[] = [
    { key: "magasin", header: "Magasin", sortKey: "magasin__code_depot", cell: (e) => `${e.code_depot} — ${e.nom_magasin}` },
    { key: "allee", header: "Allée", sortKey: "code_allee", cell: (e) => <span className="font-medium">{e.code_allee}</span> },
    { key: "etagere", header: "Étagère", sortKey: "code_etagere", cell: (e) => <span className="font-medium">{e.code_etagere}</span> },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={liste.searchInput} onChange={liste.setSearchInput} placeholder="Allée, étagère ou dépôt…" />
          <FilterSelect
            label="Magasin" className="w-52"
            options={(magasins.data ?? []).map((m) => ({ value: String(m.id_magasin), label: `${m.code_depot} — ${m.nom_magasin}` }))}
            value={String(liste.filters.magasin ?? "")}
            onChange={(v) => liste.setFilter("magasin", v)}
          />
        </div>
        {can("emplacement.create") && (
          <Button onClick={() => setEdition({ mode: "create" })}>
            <Plus className="mr-2 h-4 w-4" /> Nouvel emplacement
          </Button>
        )}
      </div>

      <DataTable
        columns={colonnes}
        data={liste.query.data}
        isLoading={liste.query.isLoading}
        isFetching={liste.query.isFetching}
        error={liste.query.error}
        rowKey={(e) => e.id_emplacement}
        page={liste.page} pageSize={liste.pageSize} onPageChange={liste.setPage}
        ordering={liste.ordering} onOrderingChange={liste.setOrdering}
        emptyMessage="Aucun emplacement."
        actions={(e) => (
          <>
            {can("emplacement.update") && (
              <Button variant="ghost" size="icon" title="Modifier" onClick={() => setEdition({ mode: "edit", item: e })}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {can("emplacement.delete") && (
              <Button variant="ghost" size="icon" title="Supprimer" onClick={() => setASupprimer(e)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </>
        )}
      />

      <FormDialog
        open={edition !== null}
        onOpenChange={(o) => !o && setEdition(null)}
        title={edition?.mode === "edit" ? "Modifier l'emplacement" : "Nouvel emplacement"}
        description="Un emplacement est identifié par son magasin, son allée et son étagère."
        onSubmit={enregistrer}
        submitting={form.formState.isSubmitting}
        error={erreurServeur}
      >
        <Field label="Magasin" error={form.formState.errors.magasin?.message}>
          <Controller
            control={form.control}
            name="magasin"
            render={({ field }) => (
              <RemoteSelect<Magasin>
                path="stock/magasins"
                value={field.value}
                onChange={field.onChange}
                getValue={(m) => m.id_magasin}
                getLabel={(m) => `${m.code_depot} — ${m.nom_magasin}`}
                placeholder="Choisir le magasin…"
              />
            )}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Allée" htmlFor="code_allee" error={form.formState.errors.code_allee?.message}>
            <Input id="code_allee" {...form.register("code_allee")} />
          </Field>
          <Field label="Étagère" htmlFor="code_etagere" error={form.formState.errors.code_etagere?.message}>
            <Input id="code_etagere" {...form.register("code_etagere")} />
          </Field>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={aSupprimer !== null}
        onOpenChange={(o) => !o && setASupprimer(null)}
        title="Supprimer l'emplacement ?"
        description={`L'emplacement ${aSupprimer?.code_depot ?? ""} · ${aSupprimer?.code_allee ?? ""}-${aSupprimer?.code_etagere ?? ""} sera supprimé. Impossible s'il contient ou a contenu du stock.`}
        confirmLabel="Supprimer"
        destructive
        loading={crud.remove.isPending}
        onConfirm={supprimer}
      />
    </div>
  );
}