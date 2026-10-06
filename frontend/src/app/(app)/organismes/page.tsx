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
import { useCrud } from "@/lib/resource";
import type { Organisme } from "@/types/clients";

const PATH = "clients/organismes";

const schema = z.object({
  nom_organisme: z.string().trim().min(1, "Le nom est obligatoire.").max(150, "150 caractères maximum."),
  code_institutionnel: z.string().trim().min(1, "Le code est obligatoire.").max(50, "50 caractères maximum."),
});
type FormValues = z.infer<typeof schema>;

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
  const liste = usePagedList<Organisme>(PATH, { ordering: "nom_organisme" });
  const crud = useCrud<Organisme, FormValues>(PATH);

  const [edition, setEdition] = useState<Edition>(null);
  const [aSupprimer, setASupprimer] = useState<Organisme | null>(null);
  const [erreurServeur, setErreurServeur] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
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
      key: "nom", header: "Organisme", sortKey: "nom_organisme",
      cell: (o) => <span className="font-medium">{o.nom_organisme}</span>,
    },
    {
      key: "code", header: "Code institutionnel", sortKey: "code_institutionnel",
      cell: (o) => <code className="text-xs">{o.code_institutionnel}</code>,
    },
    {
      key: "clients", header: "SOA rattachés", className: "text-right tabular-nums",
      cell: (o) => formatNombre(o.nb_clients),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Organismes"
        description="Ministères et collectivités qui portent un budget. Leurs SOA y sont rattachés."
        action={
          <Can privilege="organisme.create">
            <Button onClick={ouvrirCreation}>
              <Plus className="mr-2 h-4 w-4" /> Nouvel organisme
            </Button>
          </Can>
        }
      />

      <div className="mb-4">
        <SearchInput value={liste.searchInput} onChange={liste.setSearchInput} placeholder="Nom ou code institutionnel…" />
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
        emptyMessage="Aucun organisme."
        actions={(o) => (
          <>
            {can("organisme.update") && (
              <Button variant="ghost" size="icon" title="Modifier" onClick={() => ouvrirEdition(o)}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {can("organisme.delete") && (
              <Button variant="ghost" size="icon" title="Supprimer" onClick={() => setASupprimer(o)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </>
        )}
      />

      <FormDialog
        open={edition !== null}
        onOpenChange={(o) => !o && setEdition(null)}
        title={edition?.mode === "edit" ? "Modifier l'organisme" : "Nouvel organisme"}
        onSubmit={enregistrer}
        submitting={form.formState.isSubmitting}
        error={erreurServeur}
      >
        <Field label="Nom de l'organisme" htmlFor="nom_organisme" error={form.formState.errors.nom_organisme?.message}>
          <Input id="nom_organisme" autoFocus {...form.register("nom_organisme")} />
        </Field>
        <Field
          label="Code institutionnel"
          htmlFor="code_institutionnel"
          error={form.formState.errors.code_institutionnel?.message}
          hint="Unique (ex. MEN-001)."
        >
          <Input id="code_institutionnel" {...form.register("code_institutionnel")} />
        </Field>
      </FormDialog>

      <ConfirmDialog
        open={aSupprimer !== null}
        onOpenChange={(o) => !o && setASupprimer(null)}
        title="Supprimer l'organisme ?"
        description={`« ${aSupprimer?.nom_organisme ?? ""} » sera supprimé définitivement. Impossible si des clients ou des budgets y sont rattachés.`}
        confirmLabel="Supprimer"
        destructive
        loading={crud.remove.isPending}
        onConfirm={supprimer}
      />
    </div>
  );
}