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
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { Field } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { usePagedList } from "@/hooks/use-paged-list";
import { useAuth } from "@/lib/auth-context";
import { applyServerErrors } from "@/lib/form-utils";
import { formatNombre } from "@/lib/format";
import { useT } from "@/lib/i18n/contexte";
import { useCrud } from "@/lib/resource";
import type { Organisme } from "@/types/clients";

const PATH = "clients/organismes";

const schemaTraduction = (t: (c: string) => string) =>
  z.object({
    nom_organisme: z.string().trim().min(1, t("clients.org.err_nom")).max(150, t("clients.org.err_150")),
    code_institutionnel: z.string().trim().min(1, t("clients.org.err_code")).max(50, t("clients.org.err_50")),
  });
type FormValues = z.infer<ReturnType<typeof schemaTraduction>>;

type Edition = { mode: "create" } | { mode: "edit"; item: Organisme } | null;

export default function OrganismesPage() {
  return (
    <RequirePrivilege privilege="organisme.view">
      <Contenu />
    </RequirePrivilege>
  );
}

function Contenu() {
  const { can } = useAuth();
  const { t } = useT();
  const liste = usePagedList<Organisme>(PATH, { ordering: "nom_organisme" });
  const crud = useCrud<Organisme, FormValues>(PATH);

  const [edition, setEdition] = useState<Edition>(null);
  const [aSupprimer, setASupprimer] = useState<Organisme | null>(null);
  const [erreurServeur, setErreurServeur] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schemaTraduction(t)),
    defaultValues: { nom_organisme: "", code_institutionnel: "" },
  });

  // Chaque ouverture du dialogue repart d'un formulaire propre (dans les
  // gestionnaires d'ouverture, pas dans un effet : pas de rendu en cascade)
  function ouvrirCreation() {
    setErreurServeur(null);
    form.reset({ nom_organisme: "", code_institutionnel: "" });
    setEdition({ mode: "create" });
  }

  function ouvrirEdition(item: Organisme) {
    setErreurServeur(null);
    form.reset({
      nom_organisme: item.nom_organisme,
      code_institutionnel: item.code_institutionnel,
    });
    setEdition({ mode: "edit", item });
  }

  const enregistrer = form.handleSubmit(async (values) => {
    setErreurServeur(null);
    try {
      if (edition?.mode === "edit") {
        await crud.update.mutateAsync({ id: edition.item.id_organisme, body: values });
      } else {
        await crud.create.mutateAsync(values);
      }
      setEdition(null);
    } catch (e) {
      setErreurServeur(applyServerErrors(e, form.setError, ["nom_organisme", "code_institutionnel"]));
    }
  });

  async function supprimer() {
    if (!aSupprimer) return;
    try {
      await crud.remove.mutateAsync(aSupprimer.id_organisme);
    } catch {
      /* message du serveur (409 : clients ou budgets rattachés) déjà affiché */
    }
    setASupprimer(null);
  }

  const colonnes: Column<Organisme>[] = [
    {
      key: "nom", header: "clients.org.col_nom", sortKey: "nom_organisme",
      cell: (o) => <span className="font-medium">{o.nom_organisme}</span>,
    },
    {
      key: "code", header: "clients.org.col_code", sortKey: "code_institutionnel",
      cell: (o) => <code className="text-xs">{o.code_institutionnel}</code>,
    },
    {
      key: "clients", header: "clients.org.col_soa", className: "text-right tabular-nums",
      cell: (o) => formatNombre(o.nb_clients),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("clients.org.titre")}
        description={t("clients.org.description")}
        action={
          <Can privilege="organisme.create">
            <Button onClick={ouvrirCreation}>
              <Plus className="mr-2 h-4 w-4" /> {t("clients.org.nouveau")}
            </Button>
          </Can>
        }
      />

      <div className="mb-4">
        <SearchInput value={liste.searchInput} onChange={liste.setSearchInput} placeholder={t("clients.org.recherche")} />
      </div>

      <DataTable
        columns={colonnes}
        data={liste.query.data}
        isLoading={liste.query.isLoading}
        isFetching={liste.query.isFetching}
        error={liste.query.error}
        rowKey={(o) => o.id_organisme}
        page={liste.page}
        pageSize={liste.pageSize}
        onPageChange={liste.setPage}
        ordering={liste.ordering}
        onOrderingChange={liste.setOrdering}
        emptyMessage="clients.org.vide"
        actions={(o) => (
          <>
            {can("organisme.update") && (
              <Button variant="ghost" size="icon" title={t("clients.org.modifier")} aria-label={t("clients.org.modifier")} onClick={() => ouvrirEdition(o)}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {can("organisme.delete") && (
              <Button variant="ghost" size="icon" title={t("clients.org.supprimer")} aria-label={t("clients.org.supprimer")} onClick={() => setASupprimer(o)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </>
        )}
      />

      <FormDialog
        open={edition !== null}
        onOpenChange={(o) => !o && setEdition(null)}
        title={edition?.mode === "edit" ? t("clients.org.titre_modif") : t("clients.org.titre_nouveau")}
        onSubmit={enregistrer}
        submitting={form.formState.isSubmitting}
        error={erreurServeur}
      >
        <Field label={t("clients.org.nom")} htmlFor="nom_organisme" error={form.formState.errors.nom_organisme?.message}>
          <Input id="nom_organisme" autoFocus {...form.register("nom_organisme")} />
        </Field>
        <Field
          label={t("clients.org.code")}
          htmlFor="code_institutionnel"
          error={form.formState.errors.code_institutionnel?.message}
          hint={t("clients.org.code_hint")}
        >
          <Input id="code_institutionnel" {...form.register("code_institutionnel")} />
        </Field>
      </FormDialog>

      <ConfirmDialog
        open={aSupprimer !== null}
        onOpenChange={(o) => !o && setASupprimer(null)}
        title={t("clients.org.suppr_titre")}
        description={t("clients.org.suppr_desc", { nom: aSupprimer?.nom_organisme ?? "" })}
        confirmLabel={t("clients.org.supprimer_btn")}
        destructive
        loading={crud.remove.isPending}
        onConfirm={supprimer}
      />
    </div>
  );
}