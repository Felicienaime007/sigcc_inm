"use client";

import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { libelleTable } from "@/lib/audit";
import { formatDateTime } from "@/lib/format";
import type { AuditEntry } from "@/types/audit";
import { DiffTable, OperationBadge } from "./diff";

export function EntryDialog({ entry, onClose }: { entry: AuditEntry; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <OperationBadge operation={entry.operation} />
            {libelleTable(entry.table_nom)} {entry.reference ?? `n° ${entry.id_objet}`}
          </DialogTitle>
          <DialogDescription>Événement n° {entry.id_audit} · enregistré par le système, non modifiable.</DialogDescription>
        </DialogHeader>

        <dl className="grid gap-3 rounded-md border bg-muted/30 p-3 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-muted-foreground">Date et heure</dt><dd className="font-medium">{formatDateTime(entry.date_audit)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Utilisateur</dt><dd className="font-medium">{entry.identifiant_utilisateur}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Table</dt><dd className="font-medium">{entry.table_nom} (n° {entry.id_objet})</dd></div>
          <div><dt className="text-xs text-muted-foreground">Adresse IP</dt><dd className="font-medium">{entry.adresse_ip ?? "—"}</dd></div>
        </dl>

        <DiffTable entry={entry} />
      </DialogContent>
    </Dialog>
  );
}