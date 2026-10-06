"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RequirePrivilege } from "@/components/can";
import { PageHeader } from "@/components/page-header";
import { DataTable, type Column } from "@/components/data/data-table";
import { FilterSelect } from "@/components/data/filter-select";
import { SearchInput } from "@/components/data/search-input";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { ConfigDialog } from "@/components/produits/config-dialog";
import { ProduitDialog } from "@/components/produits/produit-dialog";
import { usePagedList } from "@/hooks/use-paged-list";
import { useAuth } from "@/lib/auth-context";
import { formatAr, formatNombre } from "@/lib/format";
import { useCrud, useOptions } from "@/lib/resource";
import type { Categorie, ConfigSerie, ProduitCatalogue } from "@/types/produits";

export default function ProduitsPage() {
  return (
    <RequirePrivilege privilege="produit.view">
      <Contenu />
    </RequirePrivilege>
  );
}

function Contenu() {
  const { can } = useAuth();
  const [onglet, setOnglet] = useState("catalogue");

  return (
    <div>
      <PageHeader
        title="Produits"
        description="Catalogue de l'Imprimerie Nationale et séries de numérotation des documents sécurisés."
      />
      <Tabs value={onglet} onValueChange={setOnglet}>
        <TabsList>
          <TabsTrigger value="catalogue">Catalogue</TabsTrigger>
          {can("config_serie.view") && <TabsTrigger value="series">Séries de numérotation</TabsTrigger>}
        </TabsList>
        <TabsContent value="catalogue" className="mt-6"><CatalogueTab /></TabsContent>
        <TabsContent value="series" className="mt-6"><SeriesTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------- Catalogue
type Edition = { mode: "create" } | { mode: "edit"; item: ProduitCatalogue } | null;

function CatalogueTab() {
  const { can } = useAuth();
  const liste = usePagedList<ProduitCatalogue>("produits", { ordering: "code_produit" });
  const crud = useCrud<ProduitCatalogue>("produits");
  const { data: categories } = useOptions<Categorie>("produits/categories", {}, can("categorie.view"));

  const [edition, setEdition] = useState<Edition>(null);
  const [aSupprimer, setASupprimer] = useState<ProduitCatalogue | null>(null);

  async function supprimer() {
    if (!aSupprimer) return;
    try {
      await crud.remove.mutateAsync(aSupprimer.id_produit);
    } catch {
      /* 409 : le produit figure dans des documents, des lots ou du stock */
    }
    setASupprimer(null);
  }

  const colonnes: Column<ProduitCatalogue>[] = [
    { key: "code", header: "Code", sortKey: "code_produit", cell: (p) => <code className="text-xs">{p.code_produit}</code> },
    { key: "designation", header: "Désignation", sortKey: "designation", cell: (p) => <span className="font-medium">{p.designation}</span> },
    { key: "categorie", header: "Catégorie", cell: (p) => p.libelle_categorie },
    { key: "prix", header: "Prix du tarif", sortKey: "prix_tarif", className: "text-right tabular-nums", cell: (p) => formatAr(p.prix_tarif) },
    {
      key: "serie", header: "Numérotation",
      cell: (p) =>
        p.numerote_en_serie ? (
          <div>
            <Badge variant="secondary">Série{p.prefixe_courant ? ` ${p.prefixe_courant}` : ""}</Badge>
            <p className="mt-0.5 text-xs text-muted-foreground">dernier n° {formatNombre(p.dernier_numero_valide)}</p>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={liste.searchInput} onChange={liste.setSearchInput} placeholder="Code ou désignation…" />
          {can("categorie.view") && (
            <FilterSelect
              label="Catégorie" className="w-52"
              options={(categories ?? []).map((c) => ({ value: String(c.id_categorie), label: c.libelle_categorie }))}
              value={String(liste.filters.categorie ?? "")}
              onChange={(v) => liste.setFilter("categorie", v)}
            />
          )}
          <FilterSelect
            label="Numérotation" className="w-48"
            options={[{ value: "true", label: "En série" }, { value: "false", label: "Sans série" }]}
            value={String(liste.filters.en_serie ?? "")}
            onChange={(v) => liste.setFilter("en_serie", v)}
          />
        </div>
        {can("produit.create") && (
          <Button onClick={() => setEdition({ mode: "create" })}>
            <Plus className="mr-2 h-4 w-4" /> Nouveau produit
          </Button>
        )}
      </div>

      <DataTable
        columns={colonnes}
        data={liste.query.data}
        isLoading={liste.query.isLoading}
        isFetching={liste.query.isFetching}
        error={liste.query.error}
        rowKey={(p) => p.id_produit}
        page={liste.page} pageSize={liste.pageSize} onPageChange={liste.setPage}
        ordering={liste.ordering} onOrderingChange={liste.setOrdering}
        emptyMessage="Aucun produit."
        actions={(p) => (
          <>
            {can("produit.update") && (
              <Button variant="ghost" size="icon" title="Modifier" onClick={() => setEdition({ mode: "edit", item: p })}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {can("produit.delete") && (
              <Button variant="ghost" size="icon" title="Supprimer" onClick={() => setASupprimer(p)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </>
        )}
      />

      {edition && (
        <ProduitDialog produit={edition.mode === "edit" ? edition.item : null} onClose={() => setEdition(null)} />
      )}

      <ConfirmDialog
        open={aSupprimer !== null}
        onOpenChange={(o) => !o && setASupprimer(null)}
        title="Supprimer le produit ?"
        description={`« ${aSupprimer?.designation ?? ""} » sera supprimé du catalogue. Impossible s'il figure dans des devis, commandes, factures, lots ou du stock.`}
        confirmLabel="Supprimer"
        destructive
        loading={crud.remove.isPending}
        onConfirm={supprimer}
      />
    </div>
  );
}

// ------------------------------------------------------------------- Séries
type EditionSerie = { mode: "create" } | { mode: "edit"; item: ConfigSerie } | null;

function SeriesTab() {
  const { can } = useAuth();
  const liste = usePagedList<ConfigSerie>("produits/configs-serie", { ordering: "id_config" });
  const crud = useCrud<ConfigSerie>("produits/configs-serie");

  const [edition, setEdition] = useState<EditionSerie>(null);
  const [aSupprimer, setASupprimer] = useState<ConfigSerie | null>(null);

  async function supprimer() {
    if (!aSupprimer) return;
    try {
      await crud.remove.mutateAsync(aSupprimer.id_config);
    } catch {
      /* 409 : la série est associée à un produit ou à des lots */
    }
    setASupprimer(null);
  }

  const colonnes: Column<ConfigSerie>[] = [
    { key: "id", header: "Série", sortKey: "id_config", cell: (c) => <span className="font-medium">n° {c.id_config}</span> },
    {
      key: "prefixe", header: "Préfixe", sortKey: "prefixe_courant",
      cell: (c) => (c.prefixe_courant ? <code className="text-xs">{c.prefixe_courant}</code> : <span className="text-muted-foreground">—</span>),
    },
    { key: "dernier", header: "Dernier n° utilisé", sortKey: "dernier_numero_valide", className: "text-right tabular-nums", cell: (c) => c.dernier_numero_valide },
    { key: "prochain", header: "Prochain n°", className: "text-right tabular-nums", cell: (c) => c.dernier_numero_valide + 1 },
    {
      key: "produit", header: "Produit",
      cell: (c) => c.code_produit ?? <Badge variant="outline">Libre</Badge>,
    },
    { key: "lots", header: "Lots", className: "text-right tabular-nums", cell: (c) => formatNombre(c.nb_lots) },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SearchInput value={liste.searchInput} onChange={liste.setSearchInput} placeholder="Préfixe ou produit…" />
        {can("config_serie.create") && (
          <Button onClick={() => setEdition({ mode: "create" })}>
            <Plus className="mr-2 h-4 w-4" /> Nouvelle série
          </Button>
        )}
      </div>

      <DataTable
        columns={colonnes}
        data={liste.query.data}
        isLoading={liste.query.isLoading}
        isFetching={liste.query.isFetching}
        error={liste.query.error}
        rowKey={(c) => c.id_config}
        page={liste.page} pageSize={liste.pageSize} onPageChange={liste.setPage}
        ordering={liste.ordering} onOrderingChange={liste.setOrdering}
        emptyMessage="Aucune série de numérotation."
        actions={(c) => (
          <>
            {can("config_serie.update") && (
              <Button variant="ghost" size="icon" title="Modifier le préfixe" onClick={() => setEdition({ mode: "edit", item: c })}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {can("config_serie.delete") && (
              <Button variant="ghost" size="icon" title="Supprimer" onClick={() => setASupprimer(c)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </>
        )}
      />

      {edition && (
        <ConfigDialog config={edition.mode === "edit" ? edition.item : null} onClose={() => setEdition(null)} />
      )}

      <ConfirmDialog
        open={aSupprimer !== null}
        onOpenChange={(o) => !o && setASupprimer(null)}
        title="Supprimer la série ?"
        description={`La série n° ${aSupprimer?.id_config ?? ""} sera supprimée. Impossible si elle est associée à un produit ou si des lots ont été lancés.`}
        confirmLabel="Supprimer"
        destructive
        loading={crud.remove.isPending}
        onConfirm={supprimer}
      />
    </div>
  );
}