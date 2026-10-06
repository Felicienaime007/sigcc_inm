"use client";

import { useState } from "react";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { libelleTable } from "@/lib/audit";
import { formatDateTime } from "@/lib/format";
import { useList } from "@/lib/resource";
import type { AuditEntry } from "@/types/audit";
import { DiffTable, OperationBadge } from "./diff";

/** Bouton « Historique » d'un document (invisible sans le privilège audit.view). */
export function HistoriqueButton({ table, objet, titre }: { table: string; objet: number | string; titre: string }) {
  const { can } = useAuth();
  const [ouvert, setOuvert] = useState(false);
  if (!can("audit.view")) return null;

  return (
    <>
      <Button variant="outline" onClick={() => setOuvert(true)}>
        <History className="mr-2 h-4 w-4" /> Historique
      </Button>
      {ouvert && <Historique table={table} objet={objet} titre={titre} onClose={() => setOuvert(false)} />}
    </>
  );
}

function Historique({
  table, objet, titre, onClose,
}: {
  table: string;
  objet: number | string;
  titre: string;
  onClose: () => void;
}) {
  const { data, isLoading, error } = useList<AuditEntry>("audit/journal", {
    table, objet: String(objet), page_size: 100, ordering: "-date_audit",
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Historique — {libelleTable(table)} {titre}</DialogTitle>
          <DialogDescription>Du plus récent au plus ancien. Chaque ligne indique qui a fait quoi et quand.</DialogDescription>
        </DialogHeader>

        {isLoading && <p className="py-6 text-center text-sm text-muted-foreground">Chargement…</p>}
        {!!error && <p className="py-6 text-center text-sm text-destructive">Historique indisponible.</p>}
        {data && data.results.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Aucun événement enregistré pour ce document.
          </p>
        )}

        <ol className="space-y-4">
          {data?.results.map((e) => (
            <li key={e.id_audit} className="space-y-2 rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2">
                  <OperationBadge operation={e.operation} />
                  <span className="font-medium">{e.identifiant_utilisateur}</span>
                </span>
                <span className="text-xs text-muted-foreground">{formatDateTime(e.date_audit)}</span>
              </div>
              <DiffTable entry={e} />
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}