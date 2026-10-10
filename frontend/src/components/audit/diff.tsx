import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatValeur, libelleChamp, libelleOperation } from "@/lib/audit";
import { useT } from "@/lib/i18n/contexte";
import { cn } from "@/lib/utils";
import type { AuditEntry } from "@/types/audit";

const STYLES: Record<string, string> = {
  CREATE: "bg-green-100 dark:bg-green-900/60 text-green-800 dark:text-green-200",
  UPDATE: "bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200",
  DELETE: "bg-red-100 dark:bg-red-900/60 text-red-800 dark:text-red-200",
};

export function OperationBadge({ operation }: { operation: string }) {
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", STYLES[operation] ?? "bg-muted")}>
      {libelleOperation(operation)}
    </span>
  );
}

/** Tableau « avant / après » (modification) ou liste des valeurs (création, suppression). */
export function DiffTable({ entry }: { entry: AuditEntry }) {
  const avant = entry.ancienne_valeur ?? {};
  const apres = entry.nouvelle_valeur ?? {};
  const cles = Array.from(new Set([...Object.keys(avant), ...Object.keys(apres)]));
  const modification = entry.operation === "UPDATE";
  const { t } = useT();

  if (cles.length === 0) {
    return <p className="py-3 text-center text-sm text-muted-foreground">{t("audit.diff.vide")}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("audit.diff.champ")}</TableHead>
            {modification ? (
              <>
                <TableHead>{t("audit.diff.avant")}</TableHead>
                <TableHead>{t("audit.diff.apres")}</TableHead>
              </>
            ) : (
              <TableHead>{entry.operation === "DELETE" ? t("audit.diff.valeur_supprimee") : t("audit.diff.valeur")}</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {cles.map((c) => (
            <TableRow key={c}>
              <TableCell className="font-medium">{libelleChamp(c)}</TableCell>
              {modification ? (
                <>
                  <TableCell className="text-muted-foreground line-through decoration-red-400">{formatValeur(c, avant[c])}</TableCell>
                  <TableCell className="font-medium">{formatValeur(c, apres[c])}</TableCell>
                </>
              ) : (
                <TableCell>{formatValeur(c, entry.operation === "DELETE" ? avant[c] : apres[c])}</TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}