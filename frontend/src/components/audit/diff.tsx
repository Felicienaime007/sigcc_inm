import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatValeur, libelleChamp, libelleOperation } from "@/lib/audit";
import { cn } from "@/lib/utils";
import type { AuditEntry } from "@/types/audit";

const STYLES: Record<string, string> = {
  CREATE: "bg-green-100 text-green-800",
  UPDATE: "bg-amber-100 text-amber-800",
  DELETE: "bg-red-100 text-red-800",
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

  if (cles.length === 0) {
    return <p className="py-3 text-center text-sm text-muted-foreground">Aucune valeur enregistrée.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Champ</TableHead>
            {modification ? (
              <>
                <TableHead>Avant</TableHead>
                <TableHead>Après</TableHead>
              </>
            ) : (
              <TableHead>{entry.operation === "DELETE" ? "Valeur supprimée" : "Valeur"}</TableHead>
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