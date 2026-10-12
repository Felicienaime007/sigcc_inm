"use client";

import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RequirePrivilege } from "@/components/can";
import { PageHeader } from "@/components/page-header";
import { DataTable, type Column } from "@/components/data/data-table";
import { FilterSelect } from "@/components/data/filter-select";
import { SearchInput } from "@/components/data/search-input";
import { StatusBadge } from "@/components/data/status-badge";
import { DangerConfirm } from "@/components/forms/danger-confirm";
import { Field } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { usePagedList } from "@/hooks/use-paged-list";
import { useAuth } from "@/lib/auth-context";
import { applyServerErrors } from "@/lib/form-utils";
import { formatAr, formatDateTime } from "@/lib/format";
import { useT } from "@/lib/i18n/contexte";
import { useCrud, useOptions } from "@/lib/resource";
import { anneeCourante } from "@/lib/dates";
import type { Caisse, Livre, Quittance } from "@/types/tresorie";

const TOTAL_VOLETS = 250;

export default function QuittancesPage() {
  return (
    <RequirePrivilege privilege={["quittance.view", "livre_quittance.view"]}>
      <Contenu />
    </RequirePrivilege>
  );
}

function Contenu() {
  const { t } = useT();
  const { can } = useAuth();
  const onglets = [
    can("quittance.view") && { id: "quittances", label: t("tresorerie.quittances.onglet_emises") },
    can("livre_quittance.view") && { id: "carnets", label: t("tresorerie.quittances.onglet_carnets") },
  ].filter(Boolean) as { id: string; label: string }[];
  const [choix, setChoix] = useState<string | null>(null);
  const actif = onglets.find((o) => o.id === choix)?.id ?? onglets[0]?.id;
  if (!actif) return null;

  return (
    <div>
      <PageHeader
        title={t("tresorerie.quittances.titre")}
        description={t("tresorerie.quittances.description")}
      />
      <Tabs value={actif} onValueChange={setChoix}>
        <TabsList>
          {onglets.map((o) => <TabsTrigger key={o.id} value={o.id}>{o.label}</TabsTrigger>)}
        </TabsList>
        <TabsContent value="quittances" className="mt-6"><QuittancesTab /></TabsContent>
        <TabsContent value="carnets" className="mt-6"><CarnetsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ------------------------------------------------------------- Quittances
function QuittancesTab() {
  const { t } = useT();
  const { can } = useAuth();
  const liste = usePagedList<Quittance>("tresorerie/quittances", { ordering: "-date_emission" });
  const { data: livres } = useOptions<Livre>("tresorerie/livres", {}, can("livre_quittance.view"));
  const { data: caisses } = useOptions<Caisse>("tresorerie/caisses", {}, can("caisse.view"));

  const colonnes: Column<Quittance>[] = [
    {
      key: "ref", header: "tresorerie.quittances.col_quittance",
      cell: (q) => (
        <span className="font-medium">
          {t("tresorerie.quittances.quittance_ref", { numero: q.numero_livre, feuille: q.num_feuille, volet: q.attribut_volet })}
        </span>
      ),
    },
    { key: "date", header: "tresorerie.quittances.col_emise", sortKey: "date_emission", cell: (q) => formatDateTime(q.date_emission) },
    { key: "caisse", header: "tresorerie.quittances.col_caisse", cell: (q) => q.code_caisse },
    { key: "facture", header: "tresorerie.quittances.col_facture", cell: (q) => q.num_facture ?? "—" },
    { key: "montant", header: "tresorerie.quittances.col_montant", className: "text-right tabular-nums", cell: (q) => formatAr(q.montant_regle) },
    { key: "statut", header: "tresorerie.quittances.col_statut", cell: (q) => <StatusBadge statut={q.statut} /> },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={liste.searchInput} onChange={liste.setSearchInput} placeholder={t("tresorerie.quittances.recherche")} />
        <FilterSelect
          label={t("tresorerie.quittances.filtre_carnet")} className="w-52"
          options={(livres ?? []).map((l) => ({ value: String(l.id_livre), label: l.numero_livre }))}
          value={String(liste.filters.livre ?? "")}
          onChange={(v) => liste.setFilter("livre", v)}
        />
        {can("caisse.view") && (
          <FilterSelect
            label={t("tresorerie.quittances.filtre_caisse")} className="w-52"
            options={(caisses ?? []).map((c) => ({ value: String(c.id_caisse), label: c.code_caisse }))}
            value={String(liste.filters.caisse ?? "")}
            onChange={(v) => liste.setFilter("caisse", v)}
          />
        )}
        <FilterSelect
          label={t("tresorerie.quittances.filtre_statut")} className="w-44"
          options={[{ value: "EMISE", label: t("tresorerie.quittances.opt_emises") }, { value: "ANNULEE", label: t("tresorerie.quittances.opt_annulees") }]}
          value={String(liste.filters.statut ?? "")}
          onChange={(v) => liste.setFilter("statut", v)}
        />
      </div>
      <DataTable
        columns={colonnes}
        data={liste.query.data}
        isLoading={liste.query.isLoading}
        isFetching={liste.query.isFetching}
        error={liste.query.error}
        rowKey={(q) => q.id_quittance}
        page={liste.page} pageSize={liste.pageSize} onPageChange={liste.setPage}
        ordering={liste.ordering} onOrderingChange={liste.setOrdering}
        emptyMessage="tresorerie.quittances.vide"
      />
    </div>
  );
}

// ---------------------------------------------------------------- Carnets
const schemaLivreTraduction = (t: (c: string) => string) => z.object({
  numero_livre: z.string().trim().min(1, t("tresorerie.quittances.err_numero")).max(50, t("tresorerie.quittances.err_numero_max")),
  annee_ouverture: z
    .string()
    .refine((s) => /^\d{4}$/.test(s.trim()) && Number(s) >= 2000 && Number(s) <= 2100, t("tresorerie.quittances.err_annee")),
  statut_livre: z.enum(["EN_COURS", "EPUISE"]),
});
type LivreForm = z.infer<ReturnType<typeof schemaLivreTraduction>>;

type Edition = { mode: "create" } | { mode: "edit"; item: Livre } | null;

function CarnetsTab() {
  const { t } = useT();
  const { can } = useAuth();
  const liste = usePagedList<Livre>("tresorerie/livres", { ordering: "-annee_ouverture" });
  const crud = useCrud<Livre, { numero_livre: string; annee_ouverture: number; statut_livre?: string }>("tresorerie/livres");

  const [edition, setEdition] = useState<Edition>(null);
  const [aSupprimer, setASupprimer] = useState<Livre | null>(null);
  const [erreurServeur, setErreurServeur] = useState<string | null>(null);

  const schema = useMemo(() => schemaLivreTraduction(t), [t]);
  const form = useForm<LivreForm>({
    resolver: zodResolver(schema),
    defaultValues: { numero_livre: "", annee_ouverture: String(anneeCourante()), statut_livre: "EN_COURS" },
  });

  useEffect(() => {
    if (!edition) return;
    setErreurServeur(null);
    form.reset(
      edition.mode === "edit"
        ? {
            numero_livre: edition.item.numero_livre,
            annee_ouverture: String(edition.item.annee_ouverture),
            statut_livre: edition.item.statut_livre,
          }
        : { numero_livre: "", annee_ouverture: String(anneeCourante()), statut_livre: "EN_COURS" },
    );
  }, [edition, form]);

  const enregistrer = form.handleSubmit(async (v) => {
    setErreurServeur(null);
    const body = { numero_livre: v.numero_livre, annee_ouverture: Number(v.annee_ouverture) };
    try {
      if (edition?.mode === "edit") {
        await crud.update.mutateAsync({ id: edition.item.id_livre, body: { ...body, statut_livre: v.statut_livre } });
      } else {
        await crud.create.mutateAsync(body);
      }
      setEdition(null);
    } catch (e) {
      setErreurServeur(applyServerErrors(e, form.setError, ["numero_livre", "annee_ouverture", "statut_livre"]));
    }
  });

  async function supprimer() {
    if (!aSupprimer) return;
    try {
      await crud.remove.mutateAsync(aSupprimer.id_livre);
    } catch {
      /* 409 : des quittances ont été émises sur ce carnet */
    }
    setASupprimer(null);
  }

  const colonnes: Column<Livre>[] = [
    { key: "num", header: "tresorerie.quittances.col_carnet", sortKey: "numero_livre", cell: (l) => <span className="font-medium">{l.numero_livre}</span> },
    { key: "annee", header: "tresorerie.quittances.col_ouvert", sortKey: "annee_ouverture", cell: (l) => l.annee_ouverture },
    {
      key: "usage", header: "tresorerie.quittances.col_usage", className: "min-w-48",
      cell: (l) => (
        <div className="space-y-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={l.nb_restantes <= 25 ? "h-full bg-amber-50 dark:bg-amber-950/700" : "h-full bg-primary"}
              style={{ width: `${Math.min(100, (l.nb_utilisees / TOTAL_VOLETS) * 100)}%` }}
            />
          </div>
          <p className="text-xs tabular-nums text-muted-foreground">
            {t("tresorerie.quittances.usage", { utilisees: l.nb_utilisees, total: TOTAL_VOLETS, restantes: l.nb_restantes })}
          </p>
        </div>
      ),
    },
    { key: "statut", header: "tresorerie.quittances.col_statut", cell: (l) => <StatusBadge statut={l.statut_livre} /> },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SearchInput value={liste.searchInput} onChange={liste.setSearchInput} placeholder={t("tresorerie.quittances.recherche_carnet")} />
        {can("livre_quittance.create") && (
          <Button onClick={() => setEdition({ mode: "create" })}>
            <Plus className="mr-2 h-4 w-4" /> {t("tresorerie.quittances.nouveau")}
          </Button>
        )}
      </div>

      <DataTable
        columns={colonnes}
        data={liste.query.data}
        isLoading={liste.query.isLoading}
        isFetching={liste.query.isFetching}
        error={liste.query.error}
        rowKey={(l) => l.id_livre}
        page={liste.page} pageSize={liste.pageSize} onPageChange={liste.setPage}
        ordering={liste.ordering} onOrderingChange={liste.setOrdering}
        emptyMessage="tresorerie.quittances.vide_carnets"
        rowActions={(l) => [
          ...(can("livre_quittance.update")
            ? [{ key: "modifier", label: t("tresorerie.caisses.modifier"), icon: Pencil, onSelect: () => setEdition({ mode: "edit", item: l }) }]
            : []),
          ...(can("livre_quittance.delete")
            ? [{ key: "supprimer", label: t("tresorerie.caisses.supprimer"), icon: Trash2, danger: true, onSelect: () => setASupprimer(l) }]
            : []),
        ]}
      />

      <FormDialog
        open={edition !== null}
        onOpenChange={(o) => !o && setEdition(null)}
        title={edition?.mode === "edit" ? t("tresorerie.quittances.edit_titre") : t("tresorerie.quittances.create_titre")}
        onSubmit={enregistrer}
        submitting={form.formState.isSubmitting}
        error={erreurServeur}
      >
        <Field label={t("tresorerie.quittances.champ_numero")} htmlFor="numero_livre" error={form.formState.errors.numero_livre?.message}
          hint={t("tresorerie.quittances.hint_numero")}>
          <Input id="numero_livre" autoFocus {...form.register("numero_livre")} />
        </Field>
        <Field label={t("tresorerie.quittances.champ_annee")} htmlFor="annee_ouverture" error={form.formState.errors.annee_ouverture?.message}>
          <Input id="annee_ouverture" inputMode="numeric" maxLength={4} {...form.register("annee_ouverture")} />
        </Field>
        {edition?.mode === "edit" && (
          <Field label={t("tresorerie.quittances.champ_statut")} error={form.formState.errors.statut_livre?.message}
            hint={t("tresorerie.quittances.hint_statut")}>
            <Controller
              control={form.control}
              name="statut_livre"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  items={{ EN_COURS: t("tresorerie.quittances.opt_encours"), EPUISE: t("tresorerie.quittances.opt_epuise") }}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EN_COURS">{t("tresorerie.quittances.opt_encours")}</SelectItem>
                    <SelectItem value="EPUISE">{t("tresorerie.quittances.opt_epuise")}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        )}
      </FormDialog>

      <DangerConfirm
        open={aSupprimer !== null}
        onOpenChange={(o) => !o && setASupprimer(null)}
        title={t("tresorerie.quittances.suppr_titre")}
        description={t("tresorerie.quittances.suppr_desc", { numero: aSupprimer?.numero_livre ?? "" })}
        requireText={aSupprimer ? String(aSupprimer.numero_livre) : undefined}
        confirmLabel={t("tresorerie.quittances.suppr_btn")}
        loading={crud.remove.isPending}
        onConfirm={supprimer}
      />
    </div>
  );
}
