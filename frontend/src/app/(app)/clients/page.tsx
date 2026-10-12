"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RequirePrivilege } from "@/components/can";
import { PageHeader } from "@/components/page-header";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import { TypeBadge } from "@/components/clients/type-badge";
import { DataTable, type Column } from "@/components/data/data-table";
import { FilterSelect } from "@/components/data/filter-select";
import { SearchInput } from "@/components/data/search-input";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { DangerConfirm } from "@/components/forms/danger-confirm";
import { usePagedList } from "@/hooks/use-paged-list";
import { useAuth } from "@/lib/auth-context";
import { TYPES_CLIENT, estSoa, peutGerer, typesGerables, typesVisibles } from "@/lib/clients";
import { formatAr } from "@/lib/format";
import { useT } from "@/lib/i18n/contexte";
import { useCrud, useOptions } from "@/lib/resource";
import type { Client, Organisme } from "@/types/clients";

type Edition = { mode: "create" } | { mode: "edit"; item: Client } | null;

export default function ClientsPage() {
  return (
    <RequirePrivilege privilege={["client.view", "client_simple.view"]}>
      <Contenu />
    </RequirePrivilege>
  );
}

function Contenu() {
  const { can } = useAuth();
  const { t } = useT();
  const visibles = typesVisibles(can);
  const seulementComptoir = visibles.length === 1 && visibles[0] === "SIMPLE";
  const voitSoa = visibles.includes("MINISTERE");
  const peutCreer = typesGerables(can, "create").length > 0;

  const liste = usePagedList<Client>(
    "clients/clients",
    {
      ordering: "nom_client",
      // Réception : que des SIMPLE, jamais de devis — verrouillé côté requête,
      // pas seulement côté backend (un ADMIN verrait tous les types).
      ...(seulementComptoir ? { params: { type_client: "SIMPLE" } } : {}),
    },
  );
  const crud = useCrud<Client>("clients/clients");
  const { data: organismes } = useOptions<Organisme>("clients/organismes", {}, voitSoa && can("organisme.view"));

  const [edition, setEdition] = useState<Edition>(null);
  const [aSupprimer, setASupprimer] = useState<Client | null>(null);

  async function supprimer() {
    if (!aSupprimer) return;
    try {
      await crud.remove.mutateAsync(aSupprimer.id_client);
    } catch {
      /* message du serveur (409 : engagements, commandes…) déjà affiché en notification */
    }
    setASupprimer(null);
  }

  const colonnes: Column<Client>[] = [
    {
      key: "nom", header: "clients.liste.col_client", sortKey: "nom_client",
      cell: (c) => (
        <div>
          <Link href={`/clients/${c.id_client}`} className="font-medium hover:underline">
            {c.nom_client}
          </Link>
          {c.code_soa && <p className="text-xs text-muted-foreground">SOA {c.code_soa}</p>}
        </div>
      ),
    },
    { key: "type", header: "clients.liste.col_type", sortKey: "type_client", cell: (c) => <TypeBadge type={c.type_client} /> },
    ...(voitSoa
      ? [{
          key: "organisme", header: "clients.liste.col_organisme",
          cell: (c: Client) => c.nom_organisme ?? <span className="text-muted-foreground">—</span>,
        }]
      : []),
    {
      key: "lieu", header: "clients.liste.col_lieu",
      cell: (c) =>
        estSoa(c.type_client) ? (
          <div>
            <p>{c.localisation}</p>
            <p className="text-xs text-muted-foreground">{c.nom_district} · {c.nom_region}</p>
          </div>
        ) : (
          <span>{c.ville ?? "—"}</span>
        ),
    },
    { key: "tel", header: "clients.liste.col_tel", cell: (c) => c.telephone ?? "—" },
    ...(can("solvabilite.view") && visibles.includes("PRIVE")
      ? [{
          key: "solv", header: "clients.liste.col_solv",
          cell: (c: Client) => {
            if (c.type_client !== "PRIVE") return <span className="text-muted-foreground">—</span>;
            if (!c.solvabilite) return <Badge variant="outline" className="border-amber-400 text-amber-700">{t("clients.liste.sans_fiche")}</Badge>;
            if (c.solvabilite.statut_blocage) return <Badge variant="destructive">{t("clients.liste.bloque")}</Badge>;
            return <span className="text-xs tabular-nums">{t("clients.liste.plafond", { montant: formatAr(c.solvabilite.plafond_encours) })}</span>;
          },
        }]
      : []),
  ];

  return (
    <div>
      <PageHeader
        title={seulementComptoir ? t("clients.liste.titre_comptoir") : t("clients.liste.titre")}
        description={
          seulementComptoir
            ? t("clients.liste.desc_comptoir")
            : visibles.includes("SIMPLE")
              ? t("clients.liste.desc_tous")
              : t("clients.liste.desc_sans_comptoir")
        }
        action={
          peutCreer && (
            <Button onClick={() => setEdition({ mode: "create" })}>
              <Plus className="mr-2 h-4 w-4" />
              {seulementComptoir ? t("clients.liste.nouveau_comptoir") : t("clients.liste.nouveau")}
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          value={liste.searchInput}
          onChange={liste.setSearchInput}
          placeholder={seulementComptoir ? t("clients.liste.recherche_comptoir") : t("clients.liste.recherche")}
        />
        {visibles.length > 1 && (
          <FilterSelect
            label={t("clients.liste.filtre_type")}
            options={TYPES_CLIENT.filter((tc) => visibles.includes(tc.value)).map((o) => ({ value: o.value, label: t(`clients.types.${o.value.toLowerCase()}`) }))}
            value={String(liste.filters.type_client ?? "")}
            onChange={(v) => liste.setFilter("type_client", v)}
          />
        )}
        {seulementComptoir && (
          <Badge variant="secondary" className="px-3 py-1.5">
            {t("clients.liste.badge_comptoir")}
          </Badge>
        )}
        {voitSoa && can("organisme.view") && (
          <FilterSelect
            label={t("clients.liste.filtre_organisme")}
            className="w-60"
            options={(organismes ?? []).map((o) => ({ value: String(o.id_organisme), label: o.nom_organisme }))}
            value={String(liste.filters.organisme ?? "")}
            onChange={(v) => liste.setFilter("organisme", v)}
          />
        )}
      </div>

      <DataTable
        columns={colonnes}
        data={liste.query.data}
        isLoading={liste.query.isLoading}
        isFetching={liste.query.isFetching}
        error={liste.query.error}
        rowKey={(c) => c.id_client}
        page={liste.page}
        pageSize={liste.pageSize}
        onPageChange={liste.setPage}
        ordering={liste.ordering}
        onOrderingChange={liste.setOrdering}
        emptyMessage="clients.liste.vide"
        rowActions={(c) => [
          ...(peutGerer(can, c.type_client, "update")
            ? [{ key: "modifier", label: t("clients.liste.modifier"), icon: Pencil, onSelect: () => setEdition({ mode: "edit", item: c }) }]
            : []),
          ...(peutGerer(can, c.type_client, "delete")
            ? [{ key: "supprimer", label: t("clients.liste.supprimer"), icon: Trash2, danger: true, onSelect: () => setASupprimer(c) }]
            : []),
        ]}
      />

      <ClientFormDialog
        open={edition !== null}
        onOpenChange={(o) => !o && setEdition(null)}
        client={edition?.mode === "edit" ? edition.item : null}
        typeImpose={seulementComptoir ? "SIMPLE" : undefined}
      />

      <DangerConfirm
        open={aSupprimer !== null}
        onOpenChange={(o) => !o && setASupprimer(null)}
        title={t("clients.liste.suppr_titre")}
        description={t("clients.liste.suppr_desc", { nom: aSupprimer?.nom_client ?? "" })}
        confirmLabel={t("clients.liste.supprimer_btn")}
        loading={crud.remove.isPending}
        onConfirm={supprimer}
      />
    </div>
  );
}