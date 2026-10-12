"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RequirePrivilege } from "@/components/can";
import { PageHeader } from "@/components/page-header";
import { BudgetDialog } from "@/components/budget/budget-dialog";
import { DataTable, type Column } from "@/components/data/data-table";
import { FilterSelect } from "@/components/data/filter-select";
import { SearchInput } from "@/components/data/search-input";
import { DangerConfirm } from "@/components/forms/danger-confirm";
import { Field } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { usePagedList } from "@/hooks/use-paged-list";
import { useAuth } from "@/lib/auth-context";
import { anneeCourante } from "@/lib/dates";
import { applyServerErrors } from "@/lib/form-utils";
import { formatAr, formatNombre } from "@/lib/format";
import { useT } from "@/lib/i18n/contexte";
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
  const { t } = useT();
  const [onglet, setOnglet] = useState("budgets");

  return (
    <div>
      <PageHeader
        title={t("budget.liste.titre")}
        description={t("budget.liste.description")}
      />
      <Tabs value={onglet} onValueChange={setOnglet}>
        <TabsList>
          <TabsTrigger value="budgets">{t("budget.liste.onglet_budgets")}</TabsTrigger>
          {can("type_financement.view") && <TabsTrigger value="types">{t("budget.liste.onglet_types")}</TabsTrigger>}
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
  const { t } = useT();
  const router = useRouter();
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
      key: "annee", header: "budget.budgets.col_annee", sortKey: "annee_budgetaire",
      cell: (b) => (
        <Link href={`/budget/budgets/${b.id_budget}`} className="font-medium hover:underline">
          {b.annee_budgetaire}
        </Link>
      ),
    },
    { key: "organisme", header: "budget.budgets.col_organisme", sortKey: "organisme__nom_organisme", cell: (b) => b.nom_organisme },
    { key: "alloue", header: "budget.budgets.col_alloue", className: "text-right tabular-nums", cell: (b) => formatAr(b.montant_alloue) },
    { key: "lignes", header: "budget.budgets.col_lignes", className: "text-right tabular-nums", cell: (b) => formatNombre(b.nb_lignes) },
    {
      key: "dispo", header: "budget.budgets.col_dispo", className: "text-right tabular-nums",
      cell: (b) => (b.total_disponible == null ? "—" : formatAr(b.total_disponible)),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={liste.searchInput} onChange={liste.setSearchInput} placeholder={t("budget.budgets.recherche")} />
          {can("organisme.view") && (
            <FilterSelect
              label={t("budget.budgets.filtre_organisme")} className="w-60"
              options={(organismes ?? []).map((o) => ({ value: String(o.id_organisme), label: o.nom_organisme }))}
              value={String(liste.filters.organisme ?? "")}
              onChange={(v) => liste.setFilter("organisme", v)}
            />
          )}
          <FilterSelect
            label={t("budget.budgets.filtre_annee")} className="w-36"
            options={[anneeCourante() + 1, anneeCourante(), anneeCourante() - 1, anneeCourante() - 2]
              .map((a) => ({ value: String(a), label: String(a) }))}
            value={String(liste.filters.annee ?? "")}
            onChange={(v) => liste.setFilter("annee", v)}
          />
        </div>
        {can("budget.create") && (
          <Button onClick={() => setEdition({ mode: "create" })}>
            <Plus className="mr-2 h-4 w-4" /> {t("budget.budgets.nouveau")}
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
        emptyMessage="budget.budgets.vide"
        rowActions={(b) => [
          { key: "ouvrir", label: t("budget.budgets.ouvrir"), icon: Eye, onSelect: () => router.push(`/budget/budgets/${b.id_budget}`) },
          ...(can("budget.update")
            ? [{ key: "modifier", label: t("budget.budgets.modifier"), icon: Pencil, onSelect: () => setEdition({ mode: "edit", item: b }) }]
            : []),
          ...(can("budget.delete")
            ? [{ key: "supprimer", label: t("budget.budgets.supprimer"), icon: Trash2, danger: true, onSelect: () => setASupprimer(b) }]
            : []),
        ]}
      />

      {edition && (
        <BudgetDialog budget={edition.mode === "edit" ? edition.item : null} onClose={() => setEdition(null)} />
      )}

      <DangerConfirm
        open={aSupprimer !== null}
        onOpenChange={(o) => !o && setASupprimer(null)}
        title={t("budget.budgets.suppr_titre")}
        description={t("budget.budgets.suppr_desc", { annee: aSupprimer?.annee_budgetaire ?? "", org: aSupprimer?.nom_organisme ?? "" })}
        confirmLabel={t("budget.budgets.supprimer_btn")}
        loading={crud.remove.isPending}
        onConfirm={supprimer}
      />
    </div>
  );
}

// ------------------------------------------------------ Types de financement
const schemaTypeTraduction = (t: (c: string) => string) =>
  z.object({
    libelle_financement: z.string().trim().min(1, t("budget.types.err_libelle")).max(100, t("budget.types.err_100")),
  });
type TypeForm = z.infer<ReturnType<typeof schemaTypeTraduction>>;
type EditionType = { mode: "create" } | { mode: "edit"; item: TypeFinancement } | null;

function TypesTab() {
  const { can } = useAuth();
  const { t } = useT();
  const liste = usePagedList<TypeFinancement>("budget/types-financement", { ordering: "libelle_financement" });
  const crud = useCrud<TypeFinancement, TypeForm>("budget/types-financement");

  const [edition, setEdition] = useState<EditionType>(null);
  const [aSupprimer, setASupprimer] = useState<TypeFinancement | null>(null);
  const [erreurServeur, setErreurServeur] = useState<string | null>(null);

  const form = useForm<TypeForm>({ resolver: zodResolver(schemaTypeTraduction(t)), defaultValues: { libelle_financement: "" } });

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
      key: "libelle", header: "budget.types.col_libelle", sortKey: "libelle_financement",
      cell: (tf) => <span className="font-medium">{tf.libelle_financement}</span>,
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SearchInput value={liste.searchInput} onChange={liste.setSearchInput} placeholder={t("budget.types.recherche")} />
        {can("type_financement.create") && (
          <Button onClick={() => setEdition({ mode: "create" })}>
            <Plus className="mr-2 h-4 w-4" /> {t("budget.types.nouveau")}
          </Button>
        )}
      </div>

      <DataTable
        columns={colonnes}
        data={liste.query.data}
        isLoading={liste.query.isLoading}
        isFetching={liste.query.isFetching}
        error={liste.query.error}
        rowKey={(tf) => tf.id_type_financement}
        page={liste.page} pageSize={liste.pageSize} onPageChange={liste.setPage}
        ordering={liste.ordering} onOrderingChange={liste.setOrdering}
        emptyMessage="budget.types.vide"
        rowActions={(tf) => [
          ...(can("type_financement.update")
            ? [{ key: "modifier", label: t("budget.types.modifier"), icon: Pencil, onSelect: () => setEdition({ mode: "edit", item: tf }) }]
            : []),
          ...(can("type_financement.delete")
            ? [{ key: "supprimer", label: t("budget.types.supprimer"), icon: Trash2, danger: true, onSelect: () => setASupprimer(tf) }]
            : []),
        ]}
      />

      <FormDialog
        open={edition !== null}
        onOpenChange={(o) => !o && setEdition(null)}
        title={edition?.mode === "edit" ? t("budget.types.titre_modif") : t("budget.types.titre_nouveau")}
        onSubmit={enregistrer}
        submitting={form.formState.isSubmitting}
        error={erreurServeur}
      >
        <Field label={t("budget.types.libelle")} htmlFor="libelle_financement" error={form.formState.errors.libelle_financement?.message}
          hint={t("budget.types.libelle_hint")}>
          <Input id="libelle_financement" autoFocus {...form.register("libelle_financement")} />
        </Field>
      </FormDialog>

      <DangerConfirm
        open={aSupprimer !== null}
        onOpenChange={(o) => !o && setASupprimer(null)}
        title={t("budget.types.suppr_titre")}
        description={t("budget.types.suppr_desc", { nom: aSupprimer?.libelle_financement ?? "" })}
        confirmLabel={t("budget.types.supprimer_btn")}
        loading={crud.remove.isPending}
        onConfirm={supprimer}
      />
    </div>
  );
}