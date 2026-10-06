"use client";

import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatAr, formatNombre } from "@/lib/format";

export interface LigneAffichee {
  code_produit: string;
  designation: string;
  quantite: number;
  prix?: string | number;
  total?: string | number;
}

/** Détail des lignes d'un document (bon de livraison, avoir, préparation…). */
export function LignesDialog({
  open, onOpenChange, titre, description, lignes, libelleQuantite = "Quantité",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titre: string;
  description?: string;
  lignes: LigneAffichee[];
  libelleQuantite?: string;
}) {
  const avecPrix = lignes.some((l) => l.prix !== undefined);
  const avecTotal = lignes.some((l) => l.total !== undefined);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{titre}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produit</TableHead>
                <TableHead className="text-right">{libelleQuantite}</TableHead>
                {avecPrix && <TableHead className="text-right">Prix unitaire</TableHead>}
                {avecTotal && <TableHead className="text-right">Montant</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {lignes.map((l) => (
                <TableRow key={l.code_produit}>
                  <TableCell>
                    <p className="font-medium">{l.designation}</p>
                    <p className="text-xs text-muted-foreground">{l.code_produit}</p>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatNombre(l.quantite)}</TableCell>
                  {avecPrix && <TableCell className="text-right tabular-nums">{formatAr(l.prix)}</TableCell>}
                  {avecTotal && <TableCell className="text-right tabular-nums">{formatAr(l.total)}</TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}