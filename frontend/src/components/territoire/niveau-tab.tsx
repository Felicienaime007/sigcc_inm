"use client";

import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/data/data-table";
import { FilterSelect } from "@/components/data/filter-select";
import { SearchInput } from "@/components/data/search-input";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { Field } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { HierarchyPicker } from "@/components/territoire/hierarchy-picker";
import { usePagedList } from "@/hooks/use-paged-list";
import { useAuth } from "@/lib/auth-context";
import { applyServerErrors } from "@/lib/form-utils";
import { useCrud } from "@/lib/resource";
import { LEVELS, NIVEAUX, TYPES_COMMUNE, type Ligne, type NiveauCfg } from "@/lib/territoire";

interface FormValues {
  nom: string;
  parent: number | null;
  type_commune: string;
}

type Edition = { mode: "create" } | { mode: "edit"; item: Ligne } | null;

const LIBELLE_TYPE = Object.fromEntries(TYPES_COMMUNE.map((t) => [t.value, t.label]));

export function NiveauTab({ cfg }: { cfg: NiveauCfg }) {
  const niveau = LEVELS[cfg.index];
  const parent = cfg.index > 0 ? LEVELS[cfg.index - 1] : null;
  const { can } = useAuth();

  const liste = usePagedList<Ligne>(niveau.path, { ordering: niveau.nameKey });
  const crud = useCrud<Ligne, Ligne>(niveau.path);

  const [edition, setEdition] = useState<Edition>(null);
  const [aSupprimer, setASupprimer] = useState<Ligne | null>(null);
  const [erreurServeur, setErreurServeur] = useState<string | null>(null);

  const schema = useMemo(
    () =>
      z
        .object({
          nom: z.string().trim().min(1, "Le nom est obligatoire.").max(100, "100 caractères maximum."),
          parent: z.number().nullable(),
          type_commune: z.string(),
        })
        .superRefine((v, ctx) => {
          if (parent && v.parent === null) {
            ctx.addIssue({ code: "custom", path: ["parent"], message: `${parent.label} obligatoire.` });
          }
          if (cfg.typeCommune && !v.type_commune) {
            ctx.addIssue({ code: "custom", path: ["type_commune"], message: "Le type est obligatoire." });
          }
        }),
    [parent, cfg.typeCommune],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nom: "", parent: null, type_commune: "" },
  });

  // Chaque ouverture du dialogue repart d'un formulaire propre (dans les
  // gestionnaires d'ouverture, pas dans un effet : pas de rendu en cascade)
  function ouvrirCreation() {
    setErreurServeur(null);
    form.reset({ nom: "", parent: null, type_commune: "" });
    setEdition({ mode: "create" });
  }

  function ouvrirEdition(item: Ligne) {
    setErreurServeur(null);
    form.reset({
      nom: String(item[niveau.nameKey] ?? ""),
      parent: parent ? Number(item[niveau.parentField as string]) : null,
      type_commune: String(item.type_commune ?? ""),
    });
    setEdition({ mode: "edit", item });
  }

  const enregistrer = form.handleSubmit(async (v) => {
    setErreurServeur(null);
    const body: Ligne = { [niveau.nameKey]: v.nom };
    if (parent) body[niveau.parentField as string] = v.parent;
    if (cfg.typeCommune) body.type_commune = v.type_commune;
    try {
      if (edition?.mode === "edit") {
        await crud.update.mutateAsync({ id: Number(edition.item[niveau.idKey]), body });
      } else {
        await crud.create.mutateAsync(body);
      }
      setEdition(null);
    } catch (e) {
      setErreurServeur(
        applyServerErrors(e, form.setError, ["nom", "parent", "type_commune"], {
          [niveau.nameKey]: "nom",
          [niveau.parentField ?? "_"]: "parent",
        }),
      );
    }
  });

  async function supprimer() {
    if (!aSupprimer) return;
    try {
      await crud.remove.mutateAsync(Number(aSupprimer[niveau.idKey]));
    } catch {
      /* message du serveur (409 : éléments dépendants) déjà affiché en notification */
    }
    setASupprimer(null);
  }

  const colonnes: Column<Ligne>[] = cfg.colonnes.map((c, i) => ({
    key: c.key,
    header: c.header,
    sortKey: c.sortKey,
    cell: (row) => {
      const v = row[c.field];
      if (c.format === "typeCommune") {
        return <Badge variant="outline">{LIBELLE_TYPE[String(v)] ?? String(v ?? "—")}</Badge>;
      }
      return i === 0 ? <span className="font-medium">{String(v ?? "—")}</span> : String(v ?? "—");
    },
  }));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{cfg.titre}</h2>
        {can(`${cfg.priv}.create`) && (
          <Button onClick={ouvrirCreation}>
            <Plus className="mr-2 h-4 w-4" /> {cfg.nouveau}
          </Button>
        )}
      </div>

      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={liste.searchInput} onChange={liste.setSearchInput} placeholder={cfg.recherche} />
          {cfg.typeCommune && (
            <FilterSelect
              label="Type"
              options={TYPES_COMMUNE}
              value={String(liste.filters.type_commune ?? "")}
              onChange={(v) => liste.setFilter("type_commune", v)}
            />
          )}
        </div>

        {parent && (
          <HierarchyPicker
            upTo={cfg.index - 1}
            allowEmpty
            emptyLabel="Tous"
            className="flex flex-wrap gap-3"
            itemClassName="w-52"
            onSelectionChange={(sel) => {
              for (const [indice, param] of Object.entries(cfg.filterParams)) {
                liste.setFilter(param, sel[Number(indice)] ?? null);
              }
            }}
          />
        )}
      </div>

      <DataTable
        columns={colonnes}
        data={liste.query.data}
        isLoading={liste.query.isLoading}
        isFetching={liste.query.isFetching}
        error={liste.query.error}
        rowKey={(r) => Number(r[niveau.idKey])}
        page={liste.page}
        pageSize={liste.pageSize}
        onPageChange={liste.setPage}
        ordering={liste.ordering}
        onOrderingChange={liste.setOrdering}
        emptyMessage="Aucun enregistrement."
        actions={(row) => (
          <>
            {can(`${cfg.priv}.update`) && (
                <Button variant="ghost" size="icon" title="Modifier" onClick={() => ouvrirEdition(row)}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {can(`${cfg.priv}.delete`) && (
              <Button variant="ghost" size="icon" title="Supprimer" onClick={() => setASupprimer(row)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </>
        )}
      />

      <FormDialog
        open={edition !== null}
        onOpenChange={(o) => !o && setEdition(null)}
        title={edition?.mode === "edit" ? cfg.modifier : cfg.nouveau}
        onSubmit={enregistrer}
        submitting={form.formState.isSubmitting}
        error={erreurServeur}
        wide={!!parent}
      >
        {parent && (
          <Field
            label={`Rattachement : ${parent.label.toLowerCase()}`}
            error={form.formState.errors.parent?.message}
            hint="Choisissez les niveaux dans l'ordre, du plus haut au plus bas."
          >
            <Controller
              control={form.control}
              name="parent"
              render={({ field }) => (
                <HierarchyPicker upTo={cfg.index - 1} value={field.value} onChange={field.onChange} />
              )}
            />
          </Field>
        )}

        <Field label="Nom" htmlFor="nom" error={form.formState.errors.nom?.message}>
          <Input id="nom" autoFocus {...form.register("nom")} />
        </Field>

        {cfg.typeCommune && (
          <Field label="Type de commune" error={form.formState.errors.type_commune?.message}>
            <Controller
              control={form.control}
              name="type_commune"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choisir…" />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES_COMMUNE.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        )}
      </FormDialog>

      <ConfirmDialog
        open={aSupprimer !== null}
        onOpenChange={(o) => !o && setASupprimer(null)}
        title={cfg.supprimer}
        description={`« ${aSupprimer ? String(aSupprimer[niveau.nameKey]) : ""} » sera supprimé(e) définitivement. Impossible si des éléments dépendants y sont rattachés (niveaux inférieurs, clients...).`}
        confirmLabel="Supprimer"
        destructive
        loading={crud.remove.isPending}
        onConfirm={supprimer}
      />
    </div>
  );
}

// Garde l'ordre des onglets utilisé par la page
export { NIVEAUX };