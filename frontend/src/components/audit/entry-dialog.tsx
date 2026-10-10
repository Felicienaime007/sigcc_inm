"use client";

import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { libelleTable } from "@/lib/audit";
import { formatDateTime } from "@/lib/format";
import { useT } from "@/lib/i18n/contexte";
import type { AuditEntry } from "@/types/audit";
import { DiffTable, OperationBadge } from "./diff";

export function EntryDialog({ entry, onClose }: { entry: AuditEntry; onClose: () => void }) {
  const { t } = useT();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <OperationBadge operation={entry.operation} />
            {libelleTable(entry.table_nom)} {entry.reference ?? t("audit.dialog.numero", { n: entry.id_objet })}
          </DialogTitle>
          <DialogDescription>{t("audit.dialog.description", { n: entry.id_audit })}</DialogDescription>
        </DialogHeader>

        <dl className="grid gap-3 rounded-md border bg-muted/30 p-3 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-muted-foreground">{t("audit.dialog.date")}</dt><dd className="font-medium">{formatDateTime(entry.date_audit)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{t("audit.dialog.utilisateur")}</dt><dd className="font-medium">{entry.identifiant_utilisateur}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{t("audit.dialog.table")}</dt><dd className="font-medium">{entry.table_nom} ({t("audit.dialog.numero_court", { n: entry.id_objet })})</dd></div>
          <div><dt className="text-xs text-muted-foreground">{t("audit.dialog.ip")}</dt><dd className="font-medium">{entry.adresse_ip ?? "—"}</dd></div>
        </dl>

        <DiffTable entry={entry} />
      </DialogContent>
    </Dialog>
  );
}