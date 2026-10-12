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
import { DangerConfirm } from "@/components/forms/danger-confirm";
import { PasswordInput } from "@/components/forms/password-input";
import { Field } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { usePagedList } from "@/hooks/use-paged-list";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { applyServerErrors } from "@/lib/form-utils";
import { formatDateTime } from "@/lib/format";
import { useT } from "@/lib/i18n/contexte";
import { useApiMutation, useCrud, useOptions } from "@/lib/resource";
import type { Role, Utilisateur } from "@/types/users";

const PATH = "users/utilisateurs";

const schemaTraduction = (t: (c: string) => string) =>
  z.object({
    matricule: z.string().trim().min(1, t("admin.utilisateurs.err_matricule")).max(50),
    nom_complet: z.string().trim().min(1, t("admin.utilisateurs.err_nom")).max(150),
    identifiant: z
      .string().trim()
      .min(1, t("admin.utilisateurs.err_identifiant")).max(50)
      .regex(/^\S+$/, t("admin.utilisateurs.err_identifiant_espaces")),
    password: z.string().optional(),   // obligatoire seulement à la création (vérifié à l'envoi)
    statut_compte: z.enum(["ACTIF", "INACTIF", "SUSPENDU"]),
    role_ids: z.array(z.number()),
  });
type FormValues = { matricule: string; nom_complet: string; identifiant: string; password?: string; statut_compte: "ACTIF" | "INACTIF" | "SUSPENDU"; role_ids: number[] };
const CHAMPS = ["matricule", "nom_complet", "identifiant", "password", "statut_compte", "role_ids"];

const VIDE: FormValues = {
  matricule: "", nom_complet: "", identifiant: "", password: "",
  statut_compte: "ACTIF", role_ids: [],
};

const schemaResetTraduction = (t: (c: string) => string) =>
  z
    .object({
      new_password: z.string().min(1, t("admin.utilisateurs.err_reset_mdp")),
      confirmation: z.string().min(1, t("admin.utilisateurs.err_reset_confirm")),
    })
    .refine((d) => d.new_password === d.confirmation, {
      path: ["confirmation"], message: t("admin.utilisateurs.err_reset_differents"),
    });
type ResetValues = { new_password: string; confirmation: string };

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
  const { t } = useT();
  const liste = usePagedList<Utilisateur>(PATH, { ordering: "nom_complet" });
  const crud = useCrud<Utilisateur, FormValues>(PATH);
  const { data: roles } = useOptions<Role>("users/roles");

  const STATUTS = [
    { value: "ACTIF", label: t("statuts.ACTIF") },
    { value: "INACTIF", label: t("statuts.INACTIF") },
    { value: "SUSPENDU", label: t("statuts.SUSPENDU") },
  ];

  const [edition, setEdition] = useState<Edition>(null);
  const [aSupprimer, setASupprimer] = useState<Utilisateur | null>(null);
  const [aReinitialiser, setAReinitialiser] = useState<Utilisateur | null>(null);
  const [erreurServeur, setErreurServeur] = useState<string | null>(null);
  const [erreurReset, setErreurReset] = useState<string | null>(null);

  const form = useForm<FormValues>({ resolver: zodResolver(schemaTraduction(t)), defaultValues: VIDE });
  const formReset = useForm<ResetValues>({
    resolver: zodResolver(schemaResetTraduction(t)),
    defaultValues: { new_password: "", confirmation: "" },
  });

  const reset = useApiMutation(
    async ({ id, new_password }: { id: number; new_password: string }) =>
      (await api.post(`/users/utilisateurs/${id}/set-password/`, { new_password })).data,
    { success: t("admin.utilisateurs.reset_succes"), silentError: true },
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
          form.setError("password", { message: t("admin.utilisateurs.err_mdp_obligatoire") });
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
      key: "profil", header: "admin.utilisateurs.col_profil",
      cell: (u) => <AvatarUtilisateur photo={u.photo} nom={u.nom_complet} taille="md" />,
    },
    {
      key: "nom", header: "admin.utilisateurs.col_utilisateur", sortKey: "nom_complet",
      cell: (u) => (
        <div>
          <p className="font-medium">{u.nom_complet}</p>
          <p className="text-xs text-muted-foreground">{u.identifiant}</p>
        </div>
      ),
    },
    { key: "matricule", header: "admin.utilisateurs.col_matricule", sortKey: "matricule", cell: (u) => u.matricule },
    {
      key: "roles", header: "admin.utilisateurs.col_roles",
      cell: (u) => (
        <div className="flex flex-wrap gap-1">
          {(u.roles ?? []).length === 0 && <span className="text-xs text-muted-foreground">{t("admin.utilisateurs.aucun_role")}</span>}
          {(u.roles ?? []).map((r) => (
            <Badge key={r.id_role} variant="secondary">{r.libelle_role}</Badge>
          ))}
        </div>
      ),
    },
    {
      key: "statut", header: "admin.utilisateurs.col_statut", sortKey: "statut_compte",
      cell: (u) => <StatusBadge statut={u.statut_compte} />,
    },
    {
      key: "login", header: "admin.utilisateurs.col_derniere_connexion", sortKey: "last_login",
      cell: (u) => (u.last_login ? formatDateTime(u.last_login) : <span className="text-muted-foreground">{t("admin.utilisateurs.jamais")}</span>),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("admin.utilisateurs.titre")}
        description={t("admin.utilisateurs.description")}
        action={
          <Can privilege="utilisateur.create">
            <Button onClick={ouvrirCreation}>
              <Plus className="mr-2 h-4 w-4" /> {t("admin.utilisateurs.nouveau")}
            </Button>
          </Can>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          value={liste.searchInput}
          onChange={liste.setSearchInput}
          placeholder={t("admin.utilisateurs.recherche_ph")}
        />
        <FilterSelect
          label={t("admin.utilisateurs.filtre_statut")}
          options={STATUTS}
          value={String(liste.filters.statut ?? "")}
          onChange={(v) => liste.setFilter("statut", v)}
        />
        <FilterSelect
          label={t("admin.utilisateurs.filtre_role")}
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
        emptyMessage="admin.utilisateurs.vide"
        rowActions={(u) => [
          ...(can("utilisateur.update")
            ? [
                { key: "modifier", label: t("commun.modifier"), icon: Pencil, onSelect: () => ouvrirEdition(u) },
                ...(u.id_utilisateur !== moi?.id_utilisateur
                  ? [{ key: "reinitialiser", label: t("admin.utilisateurs.reset_titre"), icon: KeyRound, onSelect: () => ouvrirReinitialisation(u) }]
                  : []),
              ]
            : []),
          ...(can("utilisateur.delete") && u.id_utilisateur !== moi?.id_utilisateur
            ? [{ key: "supprimer", label: t("commun.supprimer"), icon: Trash2, danger: true, onSelect: () => setASupprimer(u) }]
            : []),
        ]}
      />

      {/* Création / modification */}
      <FormDialog
        open={edition !== null}
        onOpenChange={(o) => !o && setEdition(null)}
        title={edition?.mode === "edit" ? t("admin.utilisateurs.modifier_titre") : t("admin.utilisateurs.nouveau_titre")}
        description={
          edition?.mode === "edit" && edition.item.id_utilisateur === moi?.id_utilisateur
            ? t("admin.utilisateurs.compte_propre")
            : undefined
        }
        onSubmit={enregistrer}
        submitting={form.formState.isSubmitting}
        error={erreurServeur}
        wide
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("admin.utilisateurs.champ_nom")} htmlFor="nom_complet" error={form.formState.errors.nom_complet?.message}>
            <Input id="nom_complet" autoFocus {...form.register("nom_complet")} />
          </Field>
          <Field label={t("admin.utilisateurs.champ_matricule")} htmlFor="matricule" error={form.formState.errors.matricule?.message}>
            <Input id="matricule" {...form.register("matricule")} />
          </Field>
          <Field label={t("admin.utilisateurs.champ_identifiant")} htmlFor="identifiant" error={form.formState.errors.identifiant?.message}>
            <Input id="identifiant" autoComplete="off" {...form.register("identifiant")} />
          </Field>
          <Field label={t("admin.utilisateurs.champ_statut")} error={form.formState.errors.statut_compte?.message}>
            <Controller
              control={form.control}
              name="statut_compte"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={edition?.mode === "edit" && edition.item.id_utilisateur === moi?.id_utilisateur}
                  items={Object.fromEntries(STATUTS.map((s) => [s.value, s.label]))}
                >
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
            label={t("admin.utilisateurs.champ_mdp_initial")}
            htmlFor="password"
            error={form.formState.errors.password?.message}
            hint={t("admin.utilisateurs.hint_mdp")}
          >
            <PasswordInput id="password" autoComplete="new-password" {...form.register("password")} />
          </Field>
        )}

        <Field label={t("admin.utilisateurs.champ_roles")} error={form.formState.errors.role_ids?.message}>
          <Controller
            control={form.control}
            name="role_ids"
            render={({ field }) => (
              <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
                {(roles ?? []).map((r: Role) => (
                  <label key={r.id_role} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={field.value.includes(r.id_role)}
                      disabled={edition?.mode === "edit" && edition.item.id_utilisateur === moi?.id_utilisateur}
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
        title={t("admin.utilisateurs.reset_dialogue_titre")}
        description={aReinitialiser ? t("admin.utilisateurs.reset_dialogue_compte", { nom: aReinitialiser.nom_complet, identifiant: aReinitialiser.identifiant }) : undefined}
        onSubmit={reinitialiser}
        submitting={formReset.formState.isSubmitting}
        error={erreurReset}
        submitLabel={t("admin.utilisateurs.reset_bouton")}
      >
        <Field
          label={t("admin.utilisateurs.champ_nouveau_mdp")} htmlFor="new_password" error={formReset.formState.errors.new_password?.message}
        >
          <PasswordInput id="new_password" autoComplete="new-password" {...formReset.register("new_password")} />
        </Field>
        <Field label={t("admin.utilisateurs.champ_confirmation")} htmlFor="confirmation" error={formReset.formState.errors.confirmation?.message}>
          <PasswordInput id="confirmation" autoComplete="new-password" showStrength={false} {...formReset.register("confirmation")} />
        </Field>
      </FormDialog>

      <DangerConfirm
        open={aSupprimer !== null}
        onOpenChange={(o) => !o && setASupprimer(null)}
        title={t("admin.utilisateurs.suppr_titre")}
        description={t("admin.utilisateurs.suppr_description", { identifiant: aSupprimer?.identifiant ?? "" })}
        confirmLabel={t("commun.supprimer")}
        loading={crud.remove.isPending}
        onConfirm={supprimer}
      />
    </div>
  );
}
