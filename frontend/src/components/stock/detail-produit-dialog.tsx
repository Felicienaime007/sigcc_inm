"use client";

import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/i18n/contexte";
import { formatDate, formatDateTime, formatNombre } from "@/lib/format";
import { estEntree } from "@/lib/stock";
import { useList, useOptions } from "@/lib/resource";
import { cn } from "@/lib/utils";
import type { LigneStock, Mouvement, Reservation, ResumeStock } from "@/types/stock";

/** Détail d'un produit : répartition par emplacement, réservations et derniers mouvements. */
export function DetailProduitDialog({ resume, onClose }: { resume: ResumeStock; onClose: () => void }) {
  const { can } = useAuth();
  const { t } = useT();
  const lignes = useOptions<LigneStock>("stock/lignes", { produit: resume.produit });
  const reservations = useList<Reservation>(
    "stock/reservations", { produit: resume.produit, page_size: 20 }, can("reservation.view"),
  );
  const mouvements = useList<Mouvement>(
    "stock/mouvements", { produit: resume.produit, page_size: 8, ordering: "-date_mouv" }, can("mouvement.view"),
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{resume.designation}</DialogTitle>
          <DialogDescription>
            {t("stock.dialog_detail.description", {
              code: resume.code_produit,
              phys: formatNombre(resume.quantite_physique),
              resa: formatNombre(resume.quantite_reservee),
              dispo: formatNombre(resume.quantite_disponible),
            })}
          </DialogDescription>
        </DialogHeader>

        <section>
          <h3 className="mb-2 text-sm font-medium">{t("stock.dialog_detail.section_repartition")}</h3>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("stock.dialog_detail.col_emplacement")}</TableHead>
                  <TableHead className="text-right">{t("stock.dialog_detail.col_physique")}</TableHead>
                  <TableHead className="text-right">{t("stock.dialog_detail.col_reserve")}</TableHead>
                  <TableHead className="text-right">{t("stock.dialog_detail.col_disponible")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lignes.isLoading && (
                  <TableRow><TableCell colSpan={4} className="py-4 text-center text-muted-foreground">{t("stock.dialog_detail.chargement")}</TableCell></TableRow>
                )}
                {lignes.data?.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{t("stock.dialog_detail.emplacement_ligne", { depot: l.code_depot, allee: l.code_allee, etagere: l.code_etagere })}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNombre(l.quantite_physique)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNombre(l.quantite_reservee)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatNombre(l.quantite_disponible)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        {can("reservation.view") && (reservations.data?.results.length ?? 0) > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-medium">{t("stock.dialog_detail.section_reservations")}</h3>
            <ul className="divide-y rounded-md border text-sm">
              {reservations.data!.results.map((r) => (
                <li key={r.id_reservation} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span>
                    {formatNombre(r.quantite_bloquee)} × {r.num_commande ? t("stock.dialog_detail.resa_commande", { num: r.num_commande }) : t("stock.dialog_detail.resa_manuelle")}
                  </span>
                  <span className="text-xs text-muted-foreground">{t("stock.dialog_detail.jusquau", { date: formatDate(r.date_limite) })}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {can("mouvement.view") && (mouvements.data?.results.length ?? 0) > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-medium">{t("stock.dialog_detail.section_mouvements")}</h3>
            <ul className="divide-y rounded-md border text-sm">
              {mouvements.data!.results.map((m) => (
                <li key={m.id_mouvement} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span>
                    <span className="font-medium">{t(`stock.mouvements.types.${m.type_mouvement}`)}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatDateTime(m.date_mouv)} · {m.libelle_emplacement ?? "—"} · {m.num_bl ?? m.reference ?? ""}
                    </span>
                  </span>
                  <span className={cn("font-medium tabular-nums", estEntree(m.type_mouvement) ? "text-green-700" : "text-amber-700")}>
                    {estEntree(m.type_mouvement) ? "+" : "−"} {formatNombre(m.quantite_mouv)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}
