"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Can, RequirePrivilege } from "@/components/can";
import { PageHeader } from "@/components/page-header";
import { AvatarUtilisateur } from "@/components/users/avatar-utilisateur";
import { DataTable, type Column } from "@/components/data/data-table";
import { FilterSelect } from "@/components/data/filter-select";
import { SearchInput } from "@/components/data/search-input";
import { StatusBadge } from "@/components/data/status-badge";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { Field } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { usePagedList } from "@/hooks/use-paged-list";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { applyServerErrors } from "@/lib/form-utils";
import { formatDateTime } from "@/lib/format";
import { useApiMutation, useCrud, useOptions } from "@/lib/resource";
import type { Role, Utilisateur } from "@/types/users";

const PATH = "users/utilisateurs";

const STATUTS = [
  { value: "ACTIF", label: "Actif" },
  { value: "INACTIF", label: "Inactif" },
  { value: "SUSPENDU", label: "Suspendu" },
];

const schema = z.object({
  matricule: z.string().trim().min(1, "Le matricule est obligatoire.").max(50),
  nom_complet: z.string().trim().min(1, "Le nom est obligatoire.").max(150),
  identifiant: z
    .string().trim()
    .min(1, "L'identifiant est obligatoire.").max(50)
    .regex(/^\S+$/, "L'identifiant ne doit pas contenir d'espace."),
  password: z.string().optional(),   // obligatoire seulement à la création (vérifié à l'envoi)
  statut_compte: z.enum(["ACTIF", "INACTIF", "SUSPENDU"]),
  role_ids: z.array(z.number()),
});
type FormValues = z.infer<typeof schema>;
const CHAMPS = ["matricule", "nom_complet", "identifiant", "password", "statut_compte", "role_ids"];

const VIDE: FormValues = {
  matricule: "", nom_complet: "", identifiant: "", password: "",
  statut_compte: "ACTIF", role_ids: [],
};

const schemaReset = z
  .object({
    new_password: z.string().min(1, "Le mot de passe est obligatoire."),
    confirmation: z.string().min(1, "Confirmez le mot de passe."),
  })
  .refine((d) => d.new_password === d.confirmation, {
    path: ["confirmation"], message: "Les deux mots de passe sont différents.",
  });
type ResetValues = z.infer<typeof schemaReset>;

type Edition = { mode: "create" } | { mode: "edit"; item: Utilisateur } | null;

export default function UtilisateursPage() {
  return (
    <RequirePrivilege privilege="utilisateur.view">
      <Contenu />
    </RequirePrivilege>
  );
}

function Contenu() {
  const { can, user: moi } = useAuth();
  const liste = usePagedList<Utilisateur>(PATH, { ordering: "nom_complet" });
  const crud = useCrud<Utilisateur, FormValues>(PATH);
  const { data: roles } = useOptions<Role>("users/roles");

  const [edition, setEdition] = useState<Edition>(null);
  const [aSupprimer, setASupprimer] = useState<Utilisateur | null>(null);
  const [aReinitialiser, setAReinitialiser] = useState<Utilisateur | null>(null);
  const [erreurServeur, setErreurServeur] = useState<string | null>(null);
  const [erreurReset, setErreurReset] = useState<string | null>(null);

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: VIDE });
  const formReset = useForm<ResetValues>({
    resolver: zodResolver(schemaReset),
    defaultValues: { new_password: "", confirmation: "" },
  });

  const reset = useApiMutation(
    async ({ id, new_password }: { id: number; new_password: string }) =>
      (await api.post(`/users/utilisateurs/${id}/set-password/`, { new_password })).data,
    { success: "Mot de passe réinitialisé.", silentError: true },
  );

  // Chaque ouverture de dialogue repart d'un formulaire propre (dans les
  // gestionnaires d'ouverture, pas dans un effet : pas de rendu en cascade)
  function ouvrirCreation() {
    setErreurServeur(null);
    form.reset(VIDE);
    setEdition({ mode: "create" });
  }

  function ouvrirEdition(item: Utilisateur) {
    setErreurServeur(null);
    form.reset({
      matricule: item.matricule,
      nom_complet: item.nom_complet,
      identifiant: item.identifiant,
      password: "",
      statut_compte: item.statut_compte,
      role_ids: (item.roles ?? []).map((r) => r.id_role),
    });
    setEdition({ mode: "edit", item });
  }

  function ouvrirReinitialisation(item: Utilisateur) {
    setErreurReset(null);
    formReset.reset({ new_password: "", confirmation: "" });
    setAReinitialiser(item);
  }

  const enregistrer = form.handleSubmit(async (values) => {
    setErreurServeur(null);
    const { password, ...reste } = values;
    try {
      if (edition?.mode === "edit") {
        await crud.update.mutateAsync({ id: edition.item.id_utilisateur, body: reste });
      } else {
        if (!password) {
          form.setError("password", { message: "Le mot de passe est obligatoire." });
          return;
        }
        await crud.create.mutateAsync({ ...reste, password });
      }
      setEdition(null);
    } catch (e) {
      setErreurServeur(applyServerErrors(e, form.setError, CHAMPS));
    }
  });

  const reinitialiser = formReset.handleSubmit(async (values) => {
    if (!aReinitialiser) return;
    setErreurReset(null);
    try {
      await reset.mutateAsync({ id: aReinitialiser.id_utilisateur, new_password: values.new_password });
      setAReinitialiser(null);
    } catch (e) {
      setErreurReset(applyServerErrors(e, formReset.setError, ["new_password"]));
    }
  });

  async function supprimer() {
    if (!aSupprimer) return;
    try {
      await crud.remove.mutateAsync(aSupprimer.id_utilisateur);
    } catch {
      /* message déjà affiché en notification */
    }
    setASupprimer(null);
  }

  const colonnes: Column<Utilisateur>[] = [
    {
      key: "profil", header: "Profil",
      cell: (u) => <AvatarUtilisateur idUtilisateur={u.id_utilisateur} nom={u.nom_complet} taille="md" />,
    },
    {
      key: "nom", header: "Utilisateur", sortKey: "nom_complet",
      cell: (u) => (
        <div>
          <p className="font-medium">{u.nom_complet}</p>
          <p className="text-xs text-muted-foreground">{u.identifiant}</p>
        </div>
      ),
    },
    { key: "matricule", header: "Matricule", sortKey: "matricule", cell: (u) => u.matricule },
    {
      key: "roles", header: "Rôles",
      cell: (u) => (
        <div className="flex flex-wrap gap-1">
          {(u.roles ?? []).length === 0 && <span className="text-xs text-muted-foreground">Aucun</span>}
          {(u.roles ?? []).map((r) => (
            <Badge key={r.id_role} variant="secondary">{r.libelle_role}</Badge>
          ))}
        </div>
      ),
    },
    {
      key: "statut", header: "Statut", sortKey: "statut_compte",
      cell: (u) => <StatusBadge statut={u.statut_compte} />,
    },
    {
      key: "login", header: "Dernière connexion", sortKey: "last_login",
      cell: (u) => (u.last_login ? formatDateTime(u.last_login) : <span className="text-muted-foreground">Jamais</span>),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Utilisateurs"
        description="Comptes de l'application et rôles attribués."
        action={
          <Can privilege="utilisateur.create">
            <Button onClick={ouvrirCreation}>
              <Plus className="mr-2 h-4 w-4" /> Nouvel utilisateur
            </Button>
          </Can>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          value={liste.searchInput}
          onChange={liste.setSearchInput}
          placeholder="Nom, identifiant ou matricule…"
        />
        <FilterSelect
          label="Statut"
          options={STATUTS}
          value={String(liste.filters.statut ?? "")}
          onChange={(v) => liste.setFilter("statut", v)}
        />
        <FilterSelect
          label="Rôle"
          options={(roles ?? []).map((r: Role) => ({ value: String(r.id_role), label: r.libelle_role }))}
          value={String(liste.filters.role ?? "")}
          onChange={(v) => liste.setFilter("role", v)}
        />
      </div>

      <DataTable
        columns={colonnes}
        data={liste.query.data}
        isLoading={liste.query.isLoading}
        isFetching={liste.query.isFetching}
        error={liste.query.error}
        rowKey={(u) => u.id_utilisateur}
        page={liste.page}
        pageSize={liste.pageSize}
        onPageChange={liste.setPage}
        ordering={liste.ordering}
        onOrderingChange={liste.setOrdering}
        emptyMessage="Aucun utilisateur."
        actions={(u) => (
          <>
            {can("utilisateur.update") && (
              <>
                <Button variant="ghost" size="icon" title="Modifier" onClick={() => ouvrirEdition(u)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" title="Réinitialiser le mot de passe" onClick={() => ouvrirReinitialisation(u)}>
                  <KeyRound className="h-4 w-4" />
                </Button>
              </>
            )}
            {can("utilisateur.delete") && u.id_utilisateur !== moi?.id_utilisateur && (
              <Button variant="ghost" size="icon" title="Supprimer" onClick={() => setASupprimer(u)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </>
        )}
      />

      {/* Création / modification */}
      <FormDialog
        open={edition !== null}
        onOpenChange={(o) => !o && setEdition(null)}
        title={edition?.mode === "edit" ? "Modifier l'utilisateur" : "Nouvel utilisateur"}
        onSubmit={enregistrer}
        submitting={form.formState.isSubmitting}
        error={erreurServeur}
        wide
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom complet" htmlFor="nom_complet" error={form.formState.errors.nom_complet?.message}>
            <Input id="nom_complet" autoFocus {...form.register("nom_complet")} />
          </Field>
          <Field label="Matricule" htmlFor="matricule" error={form.formState.errors.matricule?.message}>
            <Input id="matricule" {...form.register("matricule")} />
          </Field>
          <Field label="Identifiant de connexion" htmlFor="identifiant" error={form.formState.errors.identifiant?.message}>
            <Input id="identifiant" autoComplete="off" {...form.register("identifiant")} />
          </Field>
          <Field label="Statut du compte" error={form.formState.errors.statut_compte?.message}>
            <Controller
              control={form.control}
              name="statut_compte"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUTS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </div>

        {edition?.mode === "create" && (
          <Field
            label="Mot de passe initial"
            htmlFor="password"
            error={form.formState.errors.password?.message}
            hint="8 caractères minimum, ni trop courant ni uniquement numérique."
          >
            <Input id="password" type="password" autoComplete="new-password" {...form.register("password")} />
          </Field>
        )}

        <Field label="Rôles" error={form.formState.errors.role_ids?.message}>
          <Controller
            control={form.control}
            name="role_ids"
            render={({ field }) => (
              <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
                {(roles ?? []).map((r: Role) => (
                  <label key={r.id_role} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={field.value.includes(r.id_role)}
                      onCheckedChange={(c) =>
                        field.onChange(
                          c === true ? [...field.value, r.id_role] : field.value.filter((x) => x !== r.id_role),
                        )
                      }
                    />
                    {r.libelle_role}
                  </label>
                ))}
              </div>
            )}
          />
        </Field>
      </FormDialog>

      {/* Réinitialisation du mot de passe */}
      <FormDialog
        open={aReinitialiser !== null}
        onOpenChange={(o) => !o && setAReinitialiser(null)}
        title="Réinitialiser le mot de passe"
        description={aReinitialiser ? `Compte : ${aReinitialiser.nom_complet} (${aReinitialiser.identifiant})` : undefined}
        onSubmit={reinitialiser}
        submitting={formReset.formState.isSubmitting}
        error={erreurReset}
        submitLabel="Réinitialiser"
      >
        <Field label="Nouveau mot de passe" htmlFor="new_password" error={formReset.formState.errors.new_password?.message}>
          <Input id="new_password" type="password" autoComplete="new-password" {...formReset.register("new_password")} />
        </Field>
        <Field label="Confirmation" htmlFor="confirmation" error={formReset.formState.errors.confirmation?.message}>
          <Input id="confirmation" type="password" autoComplete="new-password" {...formReset.register("confirmation")} />
        </Field>
      </FormDialog>

      <ConfirmDialog
        open={aSupprimer !== null}
        onOpenChange={(o) => !o && setASupprimer(null)}
        title="Supprimer l'utilisateur ?"
        description={`Le compte « ${aSupprimer?.identifiant ?? ""} » sera supprimé définitivement. Pour simplement empêcher la connexion, passez plutôt son statut à Inactif.`}
        confirmLabel="Supprimer"
        destructive
        loading={crud.remove.isPending}
        onConfirm={supprimer}
      />
    </div>
  );
}