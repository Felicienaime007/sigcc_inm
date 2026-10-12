"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, Inbox, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/contexte";
import { getErrorMessage } from "@/lib/errors";
import type { Paginated } from "@/types/api";
import { Pagination } from "./pagination";
import { RowActions, type RowActionItem } from "./row-actions";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  /** Champ envoyé à ?ordering= ; si absent, la colonne n'est pas triable. */
  sortKey?: string;
  className?: string;
}

interface Props<T> {
  columns: Column<T>[];
  data?: Paginated<T>;
  isLoading: boolean;
  isFetching?: boolean;
  error?: unknown;
  rowKey: (row: T) => string | number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  ordering?: string;
  onOrderingChange?: (ordering: string) => void;
  /** Colonne d'actions alignée à droite (boutons modifier / supprimer...). */
  actions?: (row: T) => React.ReactNode;
  /** Raccourci LOT 1 : construit un <RowActions> par ligne (cumulable avec `actions`). */
  rowActions?: (row: T) => RowActionItem[];
  /** Nombre d'actions visibles avant le menu « ⋯ » (1 ou 2). */
  rowActionsMaxVisible?: 1 | 2;
  /** Libellé accessible du menu « ⋯ » des lignes. */
  rowActionsMenuLabel?: string;
  emptyMessage?: string;
  /** Réessayer après une erreur de chargement. */
  onRetry?: () => void;
  /** Densité des lignes : dense par défaut (style SaaS). */
  density?: "dense" | "comfortable";
  /** Sélection de lignes : colonne de cases + tout cocher (indéterminé géré). */
  selection?: {
    selectedIds: Array<string | number>;
    onToggleId: (id: string | number) => void;
    onTogglePage: (ids: Array<string | number>, select: boolean) => void;
  };
  /** Barre d'actions groupées affichée quand la sélection est non vide. */
  bulkBar?: React.ReactNode;
}

export function DataTable<T>({
  columns, data, isLoading, isFetching, error, rowKey,
  page, pageSize, onPageChange, ordering, onOrderingChange, actions,
  rowActions, rowActionsMaxVisible = 2, rowActionsMenuLabel,
  emptyMessage = "commun.aucun_enregistrement",
  onRetry,
  density = "dense",
  selection,
  bulkBar,
}: Props<T>) {
  const { t } = useT();
  const hasActionsColumn = Boolean(actions || rowActions);
  const colSpan = columns.length + (hasActionsColumn ? 1 : 0) + (selection ? 1 : 0);
  const dense = density === "dense";
  const lignes = data?.results ?? [];
  const idsPage = lignes.map((row) => rowKey(row));
  const nbSelectionnesPage = selection
    ? idsPage.filter((id) => selection.selectedIds.includes(id)).length
    : 0;
  const toutCoche = selection != null && idsPage.length > 0 && nbSelectionnesPage === idsPage.length;
  const partiel = selection != null && nbSelectionnesPage > 0 && nbSelectionnesPage < idsPage.length;

  function basculer(sortKey: string) {
    if (!onOrderingChange) return;
    if (ordering === sortKey) onOrderingChange(`-${sortKey}`);
    else if (ordering === `-${sortKey}`) onOrderingChange("");
    else onOrderingChange(sortKey);
  }

  function iconeTri(sortKey: string) {
    if (ordering === sortKey) return <ArrowUp className="h-3.5 w-3.5 text-primary" />;
    if (ordering === `-${sortKey}`) return <ArrowDown className="h-3.5 w-3.5 text-primary" />;
    return <ArrowUpDown className="h-3.5 w-3.5 opacity-40 transition-opacity group-hover/tri:opacity-80" />;
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border bg-card shadow-[0_1px_2px_rgb(0_0_0/0.05)]">
        <Table className={cn(dense && "table-dense")}>
          <TableHeader className="table-sticky">
            <TableRow className="hover:bg-transparent">
              {selection && (
                <TableHead className="w-10 first:pl-4">
                  <Checkbox
                    checked={toutCoche}
                    indeterminate={partiel}
                    disabled={isLoading || idsPage.length === 0}
                    onCheckedChange={(coche) => selection.onTogglePage(idsPage, coche)}
                    aria-label={t("commun.tout_selectionner")}
                  />
                </TableHead>
              )}
              {columns.map((c) => (
                <TableHead
                  key={c.key}
                  className={cn(
                    "h-10 px-3 text-[11px] font-semibold tracking-[0.06em] whitespace-nowrap text-muted-foreground uppercase first:pl-4 last:pr-4",
                    c.className,
                  )}
                >
                  {c.sortKey && onOrderingChange ? (
                    <button
                      type="button"
                      onClick={() => basculer(c.sortKey!)}
                      className="group/tri inline-flex items-center gap-1.5 rounded font-semibold uppercase outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {t(c.header)}
                      {iconeTri(c.sortKey)}
                    </button>
                  ) : (
                    t(c.header)
                  )}
                </TableHead>
              ))}
              {hasActionsColumn && (
                <TableHead className="w-px text-right last:pr-4">
                  <span className="sr-only">Actions</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>

          <TableBody className={cn(isFetching && !isLoading && "opacity-60 transition-opacity")}>
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="hover:bg-transparent">
                  <TableCell colSpan={colSpan} className="px-4 py-3">
                    <Skeleton className="h-5 w-full rounded-md" />
                  </TableCell>
                </TableRow>
              ))}

            {!isLoading && !!error && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={colSpan} className="p-0">
                  <EmptyState
                    icon={TriangleAlert}
                    title={getErrorMessage(error, t("commun.erreur_chargement"))}
                    description={t("commun.verifiez_connexion")}
                    action={
                      onRetry ? (
                        <Button variant="outline" size="sm" onClick={onRetry}>
                          {t("commun.reessayer")}
                        </Button>
                      ) : undefined
                    }
                  />
                </TableCell>
              </TableRow>
            )}

            {!isLoading && !error && data?.results?.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={colSpan} className="p-0">
                  <EmptyState
                    icon={Inbox}
                    title={t(emptyMessage)}
                    description={t("commun.ajustez_filtres")}
                  />
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              !error &&
              (data?.results ?? []).map((row) => (
                <TableRow key={rowKey(row)} className="transition-colors hover:bg-primary/[0.04]">
                  {selection && (
                    <TableCell className="w-10 first:pl-4">
                      <Checkbox
                        checked={selection.selectedIds.includes(rowKey(row))}
                        onCheckedChange={() => selection.onToggleId(rowKey(row))}
                        aria-label={t("commun.selection_ligne")}
                      />
                    </TableCell>
                  )}
                  {columns.map((c) => (
                    <TableCell key={c.key} className={cn("px-3 first:pl-4 last:pr-4", dense ? "py-2" : "py-3", c.className)}>
                      {c.cell(row)}
                    </TableCell>
                  ))}
                  {hasActionsColumn && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1 opacity-70 transition-opacity hover:opacity-100 focus-within:opacity-100">
                        {actions?.(row)}
                        {rowActions && (
                          <RowActions
                            items={rowActions(row)}
                            maxVisible={rowActionsMaxVisible}
                            menuLabel={rowActionsMenuLabel}
                          />
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      <Pagination
        page={page} pageSize={pageSize} count={data?.count ?? 0}
        onPageChange={onPageChange} disabled={isFetching}
      />

      {selection && selection.selectedIds.length > 0 && bulkBar}
    </div>
  );
}
