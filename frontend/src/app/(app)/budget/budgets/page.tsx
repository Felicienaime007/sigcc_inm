"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RequirePrivilege } from "@/components/can";
import { PageHeader } from "@/components/page-header";
import { BudgetDialog } from "@/components/budget/budget-dialog";
import { DataTable, type Column } from "@/components/data/data-table";
import { FilterSelect } from "@/components/data/filter-select";
import { SearchInput } from "@/components/data/search-input";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { Field } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { usePagedList } from "@/hooks/use-paged-list";
import { useAuth } from "@/lib/auth-context";
import { anneeCourante } from "@/lib/dates";
import { applyServerErrors } from "@/lib/form-utils";
import { formatAr, formatNombre } from "@/lib/format";
import { useCrud, useOptions } from "@/lib/resource";
import type { Organisme } from "@/types/clients";
import type { Budget, TypeFinancement } from "@/types/budget";

export default function BudgetsPage() {
  return (
    <RequirePrivilege privilege="budget.view">
      <Contenu />
    </RequirePrivilege>
  );
}

function Contenu() {
  const { can } = useAuth();
  const [onglet, setOnglet] = useState("budgets");

  return (
    <div>
      <PageHeader
        title="Budgets"
        description="Budgets annuels des organismes, lignes budgétaires et types de financement."
      />
      <Tabs value={onglet} onValueChange={setOnglet}>
        <TabsList>
          <TabsTrigger value="budgets">Budgets</TabsTrigger>
          {can("type_financement.view") && <TabsTrigger value="types">Types de financement</TabsTrigger>}
        </TabsList>
        <TabsContent value="budgets" className="mt-6"><BudgetsTab /></TabsContent>
        <TabsContent value="types" className="mt-6"><TypesTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ------------------------------------------------------------------ Budgets
type Edition = { mode: "create" } | { mode: "edit"; item: Budget } | null;

function BudgetsTab() {
  const { can } = useAuth();
  const liste = usePagedList<Budget>("budget/budgets", { ordering: "-annee_budgetaire" });
  const crud = useCrud<Budget>("budget/budgets");
  const { data: organismes } = useOptions<Organisme>("clients/organismes", {}, can("organisme.view"));

  const [edition, setEdition] = useState<Edition>(null);
  const [aSupprimer, setASupprimer] = useState<Budget | null>(null);

  async function supprimer() {
    if (!aSupprimer) return;
    try {
      await crud.remove.mutateAsync(aSupprimer.id_budget);
    } catch {
      /* 409 : le budget a des lignes budgétaires */
    }
    setASupprimer(null);
  }

  const colonnes: Column<Budget>[] = [
    {
      key: "annee", header: "Année", sortKey: "annee_budgetaire",
      cell: (b) => (
        <Link href={`/budget/budgets/${b.id_budget}`} className="font-medium hover:underline">
          {b.annee_budgetaire}
        </Link>
      ),
    },
    { key: "organisme", header: "Organisme", sortKey: "organisme__nom_organisme", cell: (b) => b.nom_organisme },
    { key: "alloue", header: "Montant alloué", className: "text-right tabular-nums", cell: (b) => formatAr(b.montant_alloue) },
    { key: "lignes", header: "Lignes", className: "text-right tabular-nums", cell: (b) => formatNombre(b.nb_lignes) },
    {
      key: "dispo", header: "Disponible sur les lignes", className: "text-right tabular-nums",
      cell: (b) => formatAr(b.total_disponible ?? 0),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={liste.searchInput} onChange={liste.setSearchInput} placeholder="Organisme ou code…" />
          {can("organisme.view") && (
            <FilterSelect
              label="Organisme" className="w-60"
              options={(organismes ?? []).map((o) => ({ value: String(o.id_organisme), label: o.nom_organisme }))}
              value={String(liste.filters.organisme ?? "")}
              onChange={(v) => liste.setFilter("organisme", v)}
            />
          )}
          <FilterSelect
            label="Année" className="w-36"
            options={[anneeCourante() + 1, anneeCourante(), anneeCourante() - 1, anneeCourante() - 2]
              .map((a) => ({ value: String(a), label: String(a) }))}
            value={String(liste.filters.annee ?? "")}
            onChange={(v) => liste.setFilter("annee", v)}
          />
        </div>
        {can("budget.create") && (
          <Button onClick={() => setEdition({ mode: "create" })}>
            <Plus className="mr-2 h-4 w-4" /> Nouveau budget
          </Button>
        )}
      </div>

      <DataTable
        columns={colonnes}
        data={liste.query.data}
        isLoading={liste.query.isLoading}
        isFetching={liste.query.isFetching}
        error={liste.query.error}
        rowKey={(b) => b.id_budget}
        page={liste.page} pageSize={liste.pageSize} onPageChange={liste.setPage}
        ordering={liste.ordering} onOrderingChange={liste.setOrdering}
        emptyMessage="Aucun budget."
        actions={(b) => (
          <>
            <Link href={`/budget/budgets/${b.id_budget}`} className={buttonVariants({ variant: "ghost", size: "icon" })} title="Ouvrir la fiche"><Eye className="h-4 w-4" /></Link>
            {can("budget.update") && (
              <Button variant="ghost" size="icon" title="Modifier" onClick={() => setEdition({ mode: "edit", item: b })}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {can("budget.delete") && (
              <Button variant="ghost" size="icon" title="Supprimer" onClick={() => setASupprimer(b)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </>
        )}
      />

      {edition && (
        <BudgetDialog budget={edition.mode === "edit" ? edition.item : null} onClose={() => setEdition(null)} />
      )}

      <ConfirmDialog
        open={aSupprimer !== null}
        onOpenChange={(o) => !o && setASupprimer(null)}
        title="Supprimer le budget ?"
        description={`Le budget ${aSupprimer?.annee_budgetaire ?? ""} de ${aSupprimer?.nom_organisme ?? ""} sera supprimé. Impossible s'il a des lignes budgétaires.`}
        confirmLabel="Supprimer"
        destructive
        loading={crud.remove.isPending}
        onConfirm={supprimer}
      />
    </div>
  );
}

// ------------------------------------------------------ Types de financement
const schemaType = z.object({
  libelle_financement: z.string().trim().min(1, "Le libellé est obligatoire.").max(100, "100 caractères maximum."),
});
type TypeForm = z.infer<typeof schemaType>;
type EditionType = { mode: "create" } | { mode: "edit"; item: TypeFinancement } | null;

function TypesTab() {
  const { can } = useAuth();
  const liste = usePagedList<TypeFinancement>("budget/types-financement", { ordering: "libelle_financement" });
  const crud = useCrud<TypeFinancement, TypeForm>("budget/types-financement");

  const [edition, setEdition] = useState<EditionType>(null);
  const [aSupprimer, setASupprimer] = useState<TypeFinancement | null>(null);
  const [erreurServeur, setErreurServeur] = useState<string | null>(null);

  const form = useForm<TypeForm>({ resolver: zodResolver(schemaType), defaultValues: { libelle_financement: "" } });

  useEffect(() => {
    if (!edition) return;
    setErreurServeur(null);
    form.reset({ libelle_financement: edition.mode === "edit" ? edition.item.libelle_financement : "" });
  }, [edition, form]);

  const enregistrer = form.handleSubmit(async (v) => {
    setErreurServeur(null);
    try {
      if (edition?.mode === "edit") await crud.update.mutateAsync({ id: edition.item.id_type_financement, body: v });
      else await crud.create.mutateAsync(v);
      setEdition(null);
    } catch (e) {
      setErreurServeur(applyServerErrors(e, form.setError, ["libelle_financement"]));
    }
  });

  async function supprimer() {
    if (!aSupprimer) return;
    try {
      await crud.remove.mutateAsync(aSupprimer.id_type_financement);
    } catch {
      /* 409 : des lignes budgétaires l'utilisent */
    }
    setASupprimer(null);
  }

  const colonnes: Column<TypeFinancement>[] = [
    {
      key: "libelle", header: "Type de financement", sortKey: "libelle_financement",
      cell: (t) => <span className="font-medium">{t.libelle_financement}</span>,
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SearchInput value={liste.searchInput} onChange={liste.setSearchInput} placeholder="Rechercher…" />
        {can("type_financement.create") && (
          <Button onClick={() => setEdition({ mode: "create" })}>
            <Plus className="mr-2 h-4 w-4" /> Nouveau type
          </Button>
        )}
      </div>

      <DataTable
        columns={colonnes}
        data={liste.query.data}
        isLoading={liste.query.isLoading}
        isFetching={liste.query.isFetching}
        error={liste.query.error}
        rowKey={(t) => t.id_type_financement}
        page={liste.page} pageSize={liste.pageSize} onPageChange={liste.setPage}
        ordering={liste.ordering} onOrderingChange={liste.setOrdering}
        emptyMessage="Aucun type de financement."
        actions={(t) => (
          <>
            {can("type_financement.update") && (
              <Button variant="ghost" size="icon" title="Modifier" onClick={() => setEdition({ mode: "edit", item: t })}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {can("type_financement.delete") && (
              <Button variant="ghost" size="icon" title="Supprimer" onClick={() => setASupprimer(t)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </>
        )}
      />

      <FormDialog
        open={edition !== null}
        onOpenChange={(o) => !o && setEdition(null)}
        title={edition?.mode === "edit" ? "Modifier le type de financement" : "Nouveau type de financement"}
        onSubmit={enregistrer}
        submitting={form.formState.isSubmitting}
        error={erreurServeur}
      >
        <Field label="Libellé" htmlFor="libelle_financement" error={form.formState.errors.libelle_financement?.message}
          hint="Ex. Budget général (RPI), Fonds propre, Financement extérieur.">
          <Input id="libelle_financement" autoFocus {...form.register("libelle_financement")} />
        </Field>
      </FormDialog>

      <ConfirmDialog
        open={aSupprimer !== null}
        onOpenChange={(o) => !o && setASupprimer(null)}
        title="Supprimer le type de financement ?"
        description={`« ${aSupprimer?.libelle_financement ?? ""} » sera supprimé. Impossible si des lignes budgétaires l'utilisent.`}
        confirmLabel="Supprimer"
        destructive
        loading={crud.remove.isPending}
        onConfirm={supprimer}
      />
    </div>
  );
}