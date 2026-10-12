"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Can, RequirePrivilege } from "@/components/can";
import { PageHeader } from "@/components/page-header";
import { PrivilegePicker } from "@/components/admin/privilege-picker";
import { DataTable, type Column } from "@/components/data/data-table";
import { SearchInput } from "@/components/data/search-input";
import { DangerConfirm } from "@/components/forms/danger-confirm";
import { Field } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { usePagedList } from "@/hooks/use-paged-list";
import { useAuth } from "@/lib/auth-context";
import { applyServerErrors } from "@/lib/form-utils";
import { formatNombre } from "@/lib/format";
import { useT } from "@/lib/i18n/contexte";
import { useCrud, useOptions } from "@/lib/resource";
import type { Privilege, Role } from "@/types/users";

const PATH = "users/roles";

const schemaTraduction = (t: (c: string) => string) =>
  z.object({
    libelle_role: z
      .string().trim()
      .min(1, t("admin.roles.err_nom_obligatoire"))
      .max(50, t("admin.roles.err_nom_max"))
      .regex(/^[A-Z0-9_]+$/, t("admin.roles.err_nom_format")),
    privilege_ids: z.array(z.number()),
  });
type FormValues = { libelle_role: string; privilege_ids: number[] };

type Edition = { mode: "create" } | { mode: "edit"; item: Role } | null;

export default function RolesPage() {
  return (
    <RequirePrivilege privilege="role.view">
      <Contenu />
    </RequirePrivilege>
  );
}

function Contenu() {
  const { can } = useAuth();
  const { t } = useT();
  const liste = usePagedList<Role>(PATH, { ordering: "libelle_role" });
  const crud = useCrud<Role, FormValues>(PATH);
  const { data: privileges } = useOptions<Privilege>("users/privileges");

  const [edition, setEdition] = useState<Edition>(null);
  const [aSupprimer, setASupprimer] = useState<Role | null>(null);
  const [erreurServeur, setErreurServeur] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schemaTraduction(t)),
    defaultValues: { libelle_role: "", privilege_ids: [] },
  });

  // Chaque ouverture du dialogue repart d'un formulaire propre (dans les
  // gestionnaires d'ouverture, pas dans un effet : pas de rendu en cascade)
  function ouvrirCreation() {
    setErreurServeur(null);
    form.reset({ libelle_role: "", privilege_ids: [] });
    setEdition({ mode: "create" });
  }

  function ouvrirEdition(item: Role) {
    setErreurServeur(null);
    form.reset({
      libelle_role: item.libelle_role,
      privilege_ids: (item.privileges ?? []).map((p) => p.id_privilege),
    });
    setEdition({ mode: "edit", item });
  }

  const enregistrer = form.handleSubmit(async (values) => {
    setErreurServeur(null);
    try {
      if (edition?.mode === "edit") {
        await crud.update.mutateAsync({ id: edition.item.id_role, body: values });
      } else {
        await crud.create.mutateAsync(values);
      }
      setEdition(null);
    } catch (e) {
      setErreurServeur(applyServerErrors(e, form.setError, ["libelle_role", "privilege_ids"]));
    }
  });

  async function supprimer() {
    if (!aSupprimer) return;
    try {
      await crud.remove.mutateAsync(aSupprimer.id_role);
    } catch {
      /* message (409 : rôle attribué) déjà affiché en notification */
    }
    setASupprimer(null);
  }

  const colonnes: Column<Role>[] = [
    {
      key: "role", header: "admin.roles.col_role", sortKey: "libelle_role",
      cell: (r) => (
        <span className="font-medium">
          {r.libelle_role}
          {r.libelle_role === "ADMIN" && <Badge className="ml-2">{t("admin.roles.acces_total")}</Badge>}
        </span>
      ),
    },
    {
      key: "privileges", header: "admin.roles.col_privileges", className: "text-right tabular-nums",
      cell: (r) => (r.libelle_role === "ADMIN" ? t("admin.roles.tous") : formatNombre((r.privileges ?? []).length)),
    },
    {
      key: "users", header: "admin.roles.col_utilisateurs", sortKey: "nb_utilisateurs", className: "text-right tabular-nums",
      cell: (r) => formatNombre(r.nb_utilisateurs),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("admin.roles.titre")}
        description={t("admin.roles.description")}
        action={
          <Can privilege="role.create">
            <Button onClick={ouvrirCreation}>
              <Plus className="mr-2 h-4 w-4" /> {t("admin.roles.nouveau")}
            </Button>
          </Can>
        }
      />

      <div className="mb-4">
        <SearchInput value={liste.searchInput} onChange={liste.setSearchInput} placeholder={t("admin.roles.recherche_ph")} />
      </div>

      <DataTable
        columns={colonnes}
        data={liste.query.data}
        isLoading={liste.query.isLoading}
        isFetching={liste.query.isFetching}
        error={liste.query.error}
        rowKey={(r) => r.id_role}
        page={liste.page}
        pageSize={liste.pageSize}
        onPageChange={liste.setPage}
        ordering={liste.ordering}
        onOrderingChange={liste.setOrdering}
        emptyMessage="admin.roles.vide"
        rowActions={(r) => {
          if (r.libelle_role === "ADMIN") return [];
          return [
            ...(can("role.update")
              ? [{ key: "modifier", label: t("commun.modifier"), icon: Pencil, onSelect: () => ouvrirEdition(r) }]
              : []),
            ...(can("role.delete")
              ? [{ key: "supprimer", label: t("commun.supprimer"), icon: Trash2, danger: true, onSelect: () => setASupprimer(r) }]
              : []),
          ];
        }}
      />

      <FormDialog
        open={edition !== null}
        onOpenChange={(o) => !o && setEdition(null)}
        title={edition?.mode === "edit" ? t("admin.roles.modifier_titre", { role: edition.item.libelle_role }) : t("admin.roles.nouveau_titre")}
        onSubmit={enregistrer}
        submitting={form.formState.isSubmitting}
        error={erreurServeur}
        wide
      >
        <Field
          label={t("admin.roles.champ_nom")}
          htmlFor="libelle_role"
          error={form.formState.errors.libelle_role?.message}
          hint={t("admin.roles.hint_nom")}
        >
          <Input id="libelle_role" autoFocus {...form.register("libelle_role")} />
        </Field>

        <Field label={t("admin.roles.champ_privileges")} error={form.formState.errors.privilege_ids?.message}>
          <Controller
            control={form.control}
            name="privilege_ids"
            render={({ field }) => (
              <PrivilegePicker
                privileges={privileges ?? []}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </Field>
      </FormDialog>

      <DangerConfirm
        open={aSupprimer !== null}
        onOpenChange={(o) => !o && setASupprimer(null)}
        title={t("admin.roles.suppr_titre")}
        description={t("admin.roles.suppr_description", { role: aSupprimer?.libelle_role ?? "" })}
        confirmLabel={t("commun.supprimer")}
        loading={crud.remove.isPending}
        onConfirm={supprimer}
      />
    </div>
  );
}
