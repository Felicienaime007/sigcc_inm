"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Can, RequirePrivilege } from "@/components/can";
import { PageHeader } from "@/components/page-header";
import { DataTable, type Column } from "@/components/data/data-table";
import { SearchInput } from "@/components/data/search-input";
import { Field } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { DangerConfirm } from "@/components/forms/danger-confirm";
import { usePagedList } from "@/hooks/use-paged-list";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/i18n/contexte";
import { useCrud } from "@/lib/resource";
import { applyServerErrors } from "@/lib/form-utils";
import { formatNombre } from "@/lib/format";

interface Categorie {
  id_categorie: number;
  libelle_categorie: string;
  nb_produits: number;
}

const schemaTraduction = (t: (c: string) => string) => z.object({
  libelle_categorie: z
    .string()
    .trim()
    .min(1, t("produits.categories.err_libelle_obligatoire"))
    .max(100, t("produits.categories.err_max_100")),
});
type FormValues = z.infer<ReturnType<typeof schemaTraduction>>;

const PATH = "produits/categories";

type Edition = { mode: "create" } | { mode: "edit"; item: Categorie } | null;

export default function CategoriesPage() {
  return (
    <RequirePrivilege privilege="categorie.view">
      <Contenu />
    </RequirePrivilege>
  );
}

function Contenu() {
  const { can } = useAuth();
  const { t } = useT();
  const liste = usePagedList<Categorie>(PATH, { ordering: "libelle_categorie" });
  const crud = useCrud<Categorie, FormValues>(PATH);

  const [edition, setEdition] = useState<Edition>(null);
  const [aSupprimer, setASupprimer] = useState<Categorie | null>(null);
  const [erreurServeur, setErreurServeur] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schemaTraduction(t)),
    defaultValues: { libelle_categorie: "" },
  });

  // Chaque ouverture du dialogue repart d'un formulaire propre (dans les
  // gestionnaires d'ouverture, pas dans un effet : pas de rendu en cascade)
  function ouvrirCreation() {
    setErreurServeur(null);
    form.reset({ libelle_categorie: "" });
    setEdition({ mode: "create" });
  }

  function ouvrirEdition(item: Categorie) {
    setErreurServeur(null);
    form.reset({ libelle_categorie: item.libelle_categorie });
    setEdition({ mode: "edit", item });
  }

  const enregistrer = form.handleSubmit(async (values) => {
    setErreurServeur(null);
    try {
      if (edition?.mode === "edit") {
        await crud.update.mutateAsync({ id: edition.item.id_categorie, body: values });
      } else {
        await crud.create.mutateAsync(values);
      }
      setEdition(null);
    } catch (e) {
      setErreurServeur(applyServerErrors(e, form.setError, ["libelle_categorie"]));
    }
  });

  async function supprimer() {
    if (!aSupprimer) return;
    try {
      await crud.remove.mutateAsync(aSupprimer.id_categorie);
    } catch {
      /* le message (ex. 409) est déjà affiché en notification */
    }
    setASupprimer(null);
  }

  const colonnes: Column<Categorie>[] = [
    {
      key: "libelle", header: "produits.categories.col_categorie", sortKey: "libelle_categorie",
      cell: (c) => <span className="font-medium">{c.libelle_categorie}</span>,
    },
    {
      key: "nb", header: "produits.categories.col_produits", sortKey: "nb_produits", className: "text-right tabular-nums",
      cell: (c) => formatNombre(c.nb_produits),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("produits.categories.titre")}
        description={t("produits.categories.description")}
        action={
          <Can privilege="categorie.create">
            <Button onClick={ouvrirCreation}>
              <Plus className="mr-2 h-4 w-4" /> {t("produits.categories.btn_nouvelle")}
            </Button>
          </Can>
        }
      />

      <div className="mb-4">
        <SearchInput
          value={liste.searchInput}
          onChange={liste.setSearchInput}
          placeholder={t("produits.categories.ph_recherche")}
        />
      </div>

      <DataTable
        columns={colonnes}
        data={liste.query.data}
        isLoading={liste.query.isLoading}
        isFetching={liste.query.isFetching}
        error={liste.query.error}
        rowKey={(c) => c.id_categorie}
        page={liste.page}
        pageSize={liste.pageSize}
        onPageChange={liste.setPage}
        ordering={liste.ordering}
        onOrderingChange={liste.setOrdering}
        emptyMessage="produits.categories.vide"
        rowActions={(c) => [
          ...(can("categorie.update")
            ? [{ key: "modifier", label: t("produits.categories.act_modifier"), icon: Pencil, onSelect: () => ouvrirEdition(c) }]
            : []),
          ...(can("categorie.delete")
            ? [{ key: "supprimer", label: t("produits.categories.act_supprimer"), icon: Trash2, danger: true, onSelect: () => setASupprimer(c) }]
            : []),
        ]}
      />

      <FormDialog
        open={edition !== null}
        onOpenChange={(o) => !o && setEdition(null)}
        title={edition?.mode === "edit" ? t("produits.categories.dlg_modifier") : t("produits.categories.dlg_nouveau")}
        onSubmit={enregistrer}
        submitting={form.formState.isSubmitting}
        error={erreurServeur}
      >
        <Field label={t("produits.categories.champ_libelle")} htmlFor="libelle_categorie" error={form.formState.errors.libelle_categorie?.message}>
          <Input id="libelle_categorie" autoFocus {...form.register("libelle_categorie")} />
        </Field>
      </FormDialog>

      <DangerConfirm
        open={aSupprimer !== null}
        onOpenChange={(o) => !o && setASupprimer(null)}
        title={t("produits.categories.confirm_suppr_titre")}
        description={t("produits.categories.confirm_suppr_desc", { libelle: aSupprimer?.libelle_categorie ?? "" })}
        confirmLabel={t("produits.categories.confirm_suppr_btn")}
        loading={crud.remove.isPending}
        onConfirm={supprimer}
      />
    </div>
  );
}
