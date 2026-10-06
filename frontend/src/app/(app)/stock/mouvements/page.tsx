"use client";

import { useState } from "react";
import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Can, RequirePrivilege } from "@/components/can";
import { PageHeader } from "@/components/page-header";
import { DataTable, type Column } from "@/components/data/data-table";
import { DateRange } from "@/components/data/data-range";
import { FilterSelect } from "@/components/data/filter-select";
import { SearchInput } from "@/components/data/search-input";
import { MouvementDialog } from "@/components/stock/mouvement-dialog";
import { usePagedList } from "@/hooks/use-paged-list";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime, formatNombre } from "@/lib/format";
import { useOptions } from "@/lib/resource";
import { TYPES_MOUVEMENT, estEntree, libelleType } from "@/lib/stock";
import { cn } from "@/lib/utils";
import type { Mouvement, ProduitRef } from "@/types/stock";

export default function MouvementsPage() {
  return (
    <RequirePrivilege privilege="mouvement.view">
      <Contenu />
    </RequirePrivilege>
  );
}

function Contenu() {
  const { can } = useAuth();
  const liste = usePagedList<Mouvement>("stock/mouvements", { ordering: "-date_mouv" });
  const produits = useOptions<ProduitRef>("produits", {}, can("produit.view"));
  const [saisie, setSaisie] = useState(false);

  const colonnes: Column<Mouvement>[] = [
    { key: "date", header: "Date", sortKey: "date_mouv", cell: (m) => formatDateTime(m.date_mouv) },
    {
      key: "type", header: "Mouvement", sortKey: "type_mouvement",
      cell: (m) => (
        <span className={cn(
          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
          estEntree(m.type_mouvement) ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800",
        )}>
          {libelleType(m.type_mouvement)}
        </span>
      ),
    },
    {
      key: "produit", header: "Produit", sortKey: "produit__code_produit",
      cell: (m) => (
        <div>
          <p className="font-medium">{m.designation}</p>
          <p className="text-xs text-muted-foreground">{m.code_produit}</p>
        </div>
      ),
    },
    {
      key: "qte", header: "Quantité", sortKey: "quantite_mouv", className: "text-right tabular-nums",
      cell: (m) => (
        <span className={estEntree(m.type_mouvement) ? "text-green-700" : "text-amber-700"}>
          {estEntree(m.type_mouvement) ? "+" : "−"} {formatNombre(m.quantite_mouv)}
        </span>
      ),
    },
    { key: "empl", header: "Emplacement", cell: (m) => m.libelle_emplacement ?? "—" },
    {
      key: "ref", header: "Référence",
      cell: (m) =>
        m.num_bl ? (
          can("livraison.view") ? (
            <Link href="/commercial/livraisons" className="hover:underline">{m.num_bl}</Link>
          ) : m.num_bl
        ) : (m.reference ?? "—"),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Mouvements de stock"
        description="Journal de toutes les entrées et sorties. Il ne se modifie pas : une erreur se corrige par un mouvement d'ajustement."
        action={
          <Can privilege="mouvement.create">
            <Button onClick={() => setSaisie(true)}>
              <SlidersHorizontal className="mr-2 h-4 w-4" /> Nouveau mouvement
            </Button>
          </Can>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={liste.searchInput} onChange={liste.setSearchInput} placeholder="Référence, produit ou n° de BL…" />
        <FilterSelect
          label="Type" className="w-56" options={TYPES_MOUVEMENT}
          value={String(liste.filters.type ?? "")} onChange={(v) => liste.setFilter("type", v)}
        />
        {can("produit.view") && (
          <FilterSelect
            label="Produit" className="w-60"
            options={(produits.data ?? []).map((p) => ({ value: String(p.id_produit), label: `${p.code_produit} — ${p.designation}` }))}
            value={String(liste.filters.produit ?? "")} onChange={(v) => liste.setFilter("produit", v)}
          />
        )}
        <DateRange
          du={String(liste.filters.du ?? "")} au={String(liste.filters.au ?? "")}
          onChange={(cle, v) => liste.setFilter(cle, v)}
        />
      </div>

      <DataTable
        columns={colonnes}
        data={liste.query.data}
        isLoading={liste.query.isLoading}
        isFetching={liste.query.isFetching}
        error={liste.query.error}
        rowKey={(m) => m.id_mouvement}
        page={liste.page} pageSize={liste.pageSize} onPageChange={liste.setPage}
        ordering={liste.ordering} onOrderingChange={liste.setOrdering}
        emptyMessage="Aucun mouvement."
      />

      {saisie && <MouvementDialog onClose={() => setSaisie(false)} />}
    </div>
  );
}