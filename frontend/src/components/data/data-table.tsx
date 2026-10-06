"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/errors";
import type { Paginated } from "@/types/api";
import { Pagination } from "./pagination";

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
  emptyMessage?: string;
}

export function DataTable<T>({
  columns, data, isLoading, isFetching, error, rowKey,
  page, pageSize, onPageChange, ordering, onOrderingChange, actions,
  emptyMessage = "Aucun enregistrement.",
}: Props<T>) {
  const colSpan = columns.length + (actions ? 1 : 0);

  function basculer(sortKey: string) {
    if (!onOrderingChange) return;
    if (ordering === sortKey) onOrderingChange(`-${sortKey}`);
    else if (ordering === `-${sortKey}`) onOrderingChange("");
    else onOrderingChange(sortKey);
  }

  function iconeTri(sortKey: string) {
    if (ordering === sortKey) return <ArrowUp className="h-3.5 w-3.5" />;
    if (ordering === `-${sortKey}`) return <ArrowDown className="h-3.5 w-3.5" />;
    return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />;
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c.key} className={c.className}>
                  {c.sortKey && onOrderingChange ? (
                    <button
                      type="button"
                      onClick={() => basculer(c.sortKey!)}
                      className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                    >
                      {c.header}
                      {iconeTri(c.sortKey)}
                    </button>
                  ) : (
                    c.header
                  )}
                </TableHead>
              ))}
              {actions && <TableHead className="w-px text-right" />}
            </TableRow>
          </TableHeader>

          <TableBody className={cn(isFetching && !isLoading && "opacity-60 transition-opacity")}>
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={colSpan}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                </TableRow>
              ))}

            {!isLoading && !!error && (
              <TableRow>
                <TableCell colSpan={colSpan} className="py-10 text-center text-destructive">
                  {getErrorMessage(error, "Impossible de charger les données.")}
                </TableCell>
              </TableRow>
            )}

            {!isLoading && !error && data?.results?.length === 0 && (
              <TableRow>
                <TableCell colSpan={colSpan} className="py-10 text-center text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              !error &&
              (data?.results ?? []).map((row) => (
                <TableRow key={rowKey(row)}>
                  {columns.map((c) => (
                    <TableCell key={c.key} className={c.className}>
                      {c.cell(row)}
                    </TableCell>
                  ))}
                  {actions && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">{actions(row)}</div>
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
    </div>
  );
}