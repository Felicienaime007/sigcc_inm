"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RequirePrivilege } from "@/components/can";
import { StatusBadge } from "@/components/data/status-badge";
import { PageHeader } from "@/components/page-header";
import { BarresHorizontales, BarresMensuelles, Kpi, Variation } from "@/components/statistiques/charts";
import { api } from "@/lib/api";
import { libelleType } from "@/lib/clients";
import { libelleTarifFacturation } from "@/lib/statistiques";
import { getErrorMessage } from "@/lib/errors";
import { formatAr, formatNombre } from "@/lib/format";
import { useT } from "@/lib/i18n/contexte";
import { libelleMode } from "@/types/tresorie";
import type { Tableau } from "@/types/statistiques";
import { cn } from "@/lib/utils";

export default function StatistiquesPage() {
  return (
    <RequirePrivilege privilege="statistiques.view">
      <Contenu />
    </RequirePrivilege>
  );
}

const COULEURS_TRANCHES: Record<string, string> = {
  echeance: "bg-green-50 dark:bg-green-950/700", t30: "bg-amber-400", t60: "bg-orange-500", t90: "bg-red-50 dark:bg-red-950/700", t90p: "bg-red-700",
};

function Carte({ titre, children, className }: { titre: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3"><CardTitle className="text-base">{titre}</CardTitle></CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Contenu() {
  const { t } = useT();
  const [annee, setAnnee] = useState<number | null>(null);
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["statistiques", annee],
    queryFn: async () =>
      (await api.get<Tableau>("/statistiques/tableau-de-bord/", { params: annee ? { annee } : {} })).data,
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (error || !data) {
    return <p className="py-16 text-center text-destructive">{getErrorMessage(error, t("stats.page.erreur"))}</p>;
  }

  const { ventes, encaissements, creances, commandes, budget, stock, production, recouvrement, caisses } = data;
  const rien = [ventes, encaissements, creances, commandes, budget, stock, production, recouvrement, caisses].every((x) => x === null);

  return (
    <div className={cn("space-y-6", isFetching && "opacity-70 transition-opacity")}>
      <PageHeader
        title={t("stats.page.titre")}
        description={t("stats.page.description")}
        action={
          <Select
            value={annee === null ? "auto" : String(data.annee)}
            onValueChange={(v) => setAnnee(v === "auto" ? null : Number(v))}
            items={{ auto: t("stats.page.annee_auto"), ...Object.fromEntries(data.annees.map((a) => [String(a), String(a)])) }}
          >
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">{t("stats.page.annee_auto")}</SelectItem>
              {data.annees.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />

      {rien && <p className="text-sm text-muted-foreground">{t("stats.page.inaccessible")}</p>}

      {/* Indicateurs clés */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ventes && (
          <Kpi
            label={t("stats.kpi.ca", { annee: data.annee })}
            valeur={formatAr(ventes.ca_net)}
            sous={<Variation actuel={ventes.ca_net} precedent={ventes.ca_net_precedent} />}
          />
        )}
        {encaissements && (
          <Kpi
            label={t("stats.kpi.encaisse", { annee: data.annee })}
            valeur={formatAr(encaissements.total)}
            ton="text-green-700"
            sous={t("stats.kpi.nb_reglements", { n: formatNombre(encaissements.nb) })}
          />
        )}
        {creances && (
          <Kpi
            label={t("stats.kpi.creances")}
            valeur={formatAr(creances.total)}
            ton={creances.en_retard > 0 ? "text-amber-600" : ""}
            sous={t("stats.kpi.creances_detail", { n: formatNombre(creances.nb), montant: formatAr(creances.en_retard) })}
          />
        )}
        {caisses && (
          <Kpi label={t("stats.kpi.caisses")} valeur={formatAr(caisses.total)} sous={t("stats.kpi.nb_caisses", { n: caisses.nb })} />
        )}
      </div>

      {/* Facturé et encaissé par mois */}
      {ventes && (
        <Carte titre={t("stats.cartes.mensuel", { annee: data.annee })}>
          <BarresMensuelles
            series={[
              { label: t("stats.series.facture"), className: "bg-primary", values: ventes.mensuel_facture },
              ...(encaissements ? [{ label: t("stats.series.encaisse"), className: "bg-green-50 dark:bg-green-950/700", values: encaissements.mensuel }] : []),
              { label: t("stats.series.avoirs"), className: "bg-red-400", values: ventes.mensuel_avoirs },
            ]}
          />
          <p className="mt-3 text-xs text-muted-foreground">
            {t("stats.cartes.note_encaisse")}
          </p>
        </Carte>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {ventes && (
          <Carte titre={t("stats.cartes.par_type")}>
            <BarresHorizontales
              items={ventes.par_type_client.map((x) => ({
                cle: x.type, label: t(libelleType(x.type)), valeur: x.ht,
                detail: t("stats.details.factures", { n: formatNombre(x.n) }),
              }))}
              vide={t("stats.vides.facture_annee")}
            />
          </Carte>
        )}
        {encaissements && (
          <Carte titre={t("stats.cartes.enc_par_mode")}>
            <BarresHorizontales
              items={encaissements.par_mode.map((m) => ({
                cle: m.mode, label: t(libelleMode(m.mode)), valeur: m.total,
                detail: t("stats.details.reglements", { n: formatNombre(m.n) }), className: "bg-green-50 dark:bg-green-950/700",
              }))}
              vide={t("stats.vides.encaissement_annee")}
            />
          </Carte>
        )}
      </div>

      {creances && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Carte titre={t("stats.cartes.creances_age")}>
            <BarresHorizontales
              items={creances.tranches.map((x) => ({
                cle: x.cle, label: x.label, valeur: x.total,
                detail: t("stats.details.factures", { n: formatNombre(x.n) }), className: COULEURS_TRANCHES[x.cle],
              }))}
              vide={t("stats.vides.creance")}
            />
            <p className="mt-3 text-xs text-muted-foreground">
              {t("stats.cartes.note_anciennete")}
            </p>
          </Carte>
          <Carte titre={t("stats.cartes.creances_mode")}>
            <BarresHorizontales
              items={creances.par_mode.map((m) => ({
                cle: m.type_facturation, label: libelleTarifFacturation(m.type_facturation), valeur: m.total,
                detail: t("stats.details.factures", { n: formatNombre(m.n) }), className: "bg-amber-50 dark:bg-amber-950/700",
              }))}
              vide={t("stats.vides.creance")}
            />
          </Carte>
        </div>
      )}

      {ventes && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Carte titre={t("stats.cartes.top_clients")}>
            <BarresHorizontales
              items={ventes.top_clients.map((c) => ({
                cle: String(c.client), label: c.nom_client, valeur: c.ht, detail: t("stats.details.factures", { n: formatNombre(c.n) }),
              }))}
              vide={t("stats.vides.facture_annee")}
            />
          </Carte>
          <Carte titre={t("stats.cartes.top_produits")}>
            <BarresHorizontales
              items={ventes.top_produits.map((p) => ({
                cle: String(p.produit), label: p.designation, valeur: p.ca,
                detail: t("stats.details.unites", { code: p.code_produit, n: formatNombre(p.quantite) }), className: "bg-violet-500",
              }))}
              vide={t("stats.vides.vente_annee")}
            />
          </Carte>
        </div>
      )}

      {(ventes || commandes) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {ventes && (
            <Carte titre={t("stats.cartes.factures_statut")}>
              <ul className="divide-y text-sm">
                {ventes.par_statut_paiement.length === 0 && <li className="py-4 text-center text-muted-foreground">{t("stats.vides.facture")}</li>}
                {ventes.par_statut_paiement.map((s) => (
                  <li key={s.statut} className="flex items-center justify-between py-2">
                    <StatusBadge statut={s.statut} />
                    <span className="tabular-nums">{t("stats.details.facture_montant", { n: formatNombre(s.n), montant: formatAr(s.ht) })}</span>
                  </li>
                ))}
              </ul>
            </Carte>
          )}
          {commandes && (
            <Carte titre={t("stats.cartes.commandes_statut")}>
              <ul className="divide-y text-sm">
                {commandes.par_statut.length === 0 && <li className="py-4 text-center text-muted-foreground">{t("stats.vides.commande")}</li>}
                {commandes.par_statut.map((s) => (
                  <li key={s.statut} className="flex items-center justify-between py-2">
                    <StatusBadge statut={s.statut} />
                    <span className="tabular-nums">{formatNombre(s.n)}</span>
                  </li>
                ))}
              </ul>
            </Carte>
          )}
        </div>
      )}

      {budget && (
        <Carte titre={t("stats.cartes.budget", { annee: budget.annee })}>
          {budget.organismes.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{t("stats.vides.budget")}</p>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-4 text-sm sm:grid-cols-4">
                <div><p className="text-xs text-muted-foreground">{t("stats.budget.alloue")}</p><p className="font-semibold tabular-nums">{formatAr(budget.alloue)}</p></div>
                <div><p className="text-xs text-muted-foreground">{t("stats.budget.dotation")}</p><p className="font-semibold tabular-nums">{formatAr(budget.dotation)}</p></div>
                <div><p className="text-xs text-muted-foreground">{t("stats.budget.engage")}</p><p className="font-semibold tabular-nums text-amber-600">{formatAr(budget.engage)}</p></div>
                <div><p className="text-xs text-muted-foreground">{t("stats.budget.disponible")}</p><p className="font-semibold tabular-nums text-green-700">{formatAr(budget.disponible)}</p></div>
              </div>
              <ul className="space-y-3">
                {budget.organismes.map((o) => (
                  <li key={o.organisme} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="font-medium">{o.organisme}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {t("stats.budget.ligne", { engage: formatAr(o.engage), dotation: formatAr(o.dotation), taux: o.taux })}
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-muted" title={t("stats.budget.barre", { taux: o.taux })}>
                      <div
                        className={cn("h-full rounded-full", o.taux >= 90 ? "bg-red-50 dark:bg-red-950/700" : o.taux >= 70 ? "bg-amber-50 dark:bg-amber-950/700" : "bg-primary")}
                        style={{ width: `${Math.min(100, o.taux)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Carte>
      )}

      {(stock || production || recouvrement) && (
        <div className="grid gap-4 lg:grid-cols-3">
          {stock && (
            <Carte titre={t("stats.cartes.stock")}>
              <div className="space-y-3 text-sm">
                <div><p className="text-xs text-muted-foreground">{t("stats.stock.valeur")}</p>
                  <p className="text-lg font-semibold tabular-nums">{formatAr(stock.valeur)}</p></div>
                <p>
                  <span className={cn("font-semibold", stock.nb_ruptures > 0 && "text-red-600")}>{stock.nb_ruptures}</span>{" "}
                  {t("stats.stock.ruptures", { sans: stock.sans_stock })}
                </p>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">{t("stats.stock.plus_faibles")}</p>
                  <ul className="divide-y">
                    {stock.plus_faibles.length === 0 && <li className="py-2 text-muted-foreground">{t("stats.vides.stock")}</li>}
                    {stock.plus_faibles.map((p) => (
                      <li key={p.produit} className="flex justify-between gap-2 py-1.5">
                        <span className="truncate">{p.designation}</span>
                        <span className={cn("tabular-nums", p.disponible <= 0 && "font-semibold text-red-600")}>{formatNombre(p.disponible)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Carte>
          )}
          {production && (
            <Carte titre={t("stats.cartes.production", { annee: data.annee })}>
              <div className="space-y-3 text-sm">
                <p>{t("stats.production.a_faire", { n: production.a_faire })}</p>
                <ul className="divide-y">
                  {production.par_statut.length === 0 && <li className="py-2 text-muted-foreground">{t("stats.vides.lots")}</li>}
                  {production.par_statut.map((s) => (
                    <li key={s.statut} className="flex items-center justify-between py-2">
                      <StatusBadge statut={s.statut} />
                      <span className="tabular-nums">{t("stats.production.ligne", { n: formatNombre(s.n), qte: formatNombre(s.quantite) })}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Carte>
          )}
          {recouvrement && (
            <Carte titre={t("stats.cartes.recouvrement")}>
              <div className="space-y-3 text-sm">
                <div><p className="text-xs text-muted-foreground">{t("stats.recouvrement.a_recouvrer")}</p>
                  <p className="text-lg font-semibold tabular-nums text-red-600">{formatAr(recouvrement.montant_actif)}</p></div>
                <ul className="divide-y">
                  {recouvrement.par_statut.length === 0 && <li className="py-2 text-muted-foreground">{t("stats.vides.dossier")}</li>}
                  {recouvrement.par_statut.map((s) => (
                    <li key={s.statut} className="flex items-center justify-between py-2">
                      <StatusBadge statut={s.statut} /><span className="tabular-nums">{formatNombre(s.n)}</span>
                    </li>
                  ))}
                </ul>
                {recouvrement.par_niveau.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t("stats.recouvrement.par_niveau", { details: recouvrement.par_niveau.map((n) => t("stats.recouvrement.niveau_item", { niveau: n.niveau, n: n.n })).join(" · ") })}
                  </p>
                )}
              </div>
            </Carte>
          )}
        </div>
      )}
    </div>
  );
}
