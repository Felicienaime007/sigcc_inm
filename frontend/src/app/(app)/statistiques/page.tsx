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
  echeance: "bg-green-500", t30: "bg-amber-400", t60: "bg-orange-500", t90: "bg-red-500", t90p: "bg-red-700",
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
    return <p className="py-16 text-center text-destructive">{getErrorMessage(error, "Statistiques indisponibles.")}</p>;
  }

  const { ventes, encaissements, creances, commandes, budget, stock, production, recouvrement, caisses } = data;
  const rien = [ventes, encaissements, creances, commandes, budget, stock, production, recouvrement, caisses].every((x) => x === null);

  return (
    <div className={cn("space-y-6", isFetching && "opacity-70 transition-opacity")}>
      <PageHeader
        title="Analyse & statistiques"
        description="Activité commerciale et financière de l'Imprimerie Nationale. Mise à jour automatique."
        action={
          <Select value={String(data.annee)} onValueChange={(v) => setAnnee(Number(v))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {data.annees.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />

      {rien && <p className="text-sm text-muted-foreground">Aucune statistique n'est accessible avec vos privilèges.</p>}

      {/* Indicateurs clés */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ventes && (
          <Kpi
            label={`Chiffre d'affaires net ${data.annee} (HT)`}
            valeur={formatAr(ventes.ca_net)}
            sous={<Variation actuel={ventes.ca_net} precedent={ventes.ca_net_precedent} />}
          />
        )}
        {encaissements && (
          <Kpi
            label={`Encaissé en ${data.annee}`}
            valeur={formatAr(encaissements.total)}
            ton="text-green-700"
            sous={`${formatNombre(encaissements.nb)} règlement(s)`}
          />
        )}
        {creances && (
          <Kpi
            label="Créances (reste dû TTC)"
            valeur={formatAr(creances.total)}
            ton={creances.en_retard > 0 ? "text-amber-600" : ""}
            sous={`${formatNombre(creances.nb)} facture(s) · dont ${formatAr(creances.en_retard)} en retard`}
          />
        )}
        {caisses && (
          <Kpi label="Solde des caisses" valeur={formatAr(caisses.total)} sous={`${caisses.nb} caisse(s)`} />
        )}
      </div>

      {/* Facturé et encaissé par mois */}
      {ventes && (
        <Carte titre={`Facturé et encaissé par mois — ${data.annee}`}>
          <BarresMensuelles
            series={[
              { label: "Facturé HT", className: "bg-primary", values: ventes.mensuel_facture },
              ...(encaissements ? [{ label: "Encaissé", className: "bg-green-500", values: encaissements.mensuel }] : []),
              { label: "Avoirs HT", className: "bg-red-400", values: ventes.mensuel_avoirs },
            ]}
          />
          <p className="mt-3 text-xs text-muted-foreground">
            L'encaissé du mois peut concerner des factures émises les mois ou années précédents.
          </p>
        </Carte>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {ventes && (
          <Carte titre="Facturé par type de client (HT)">
            <BarresHorizontales
              items={ventes.par_type_client.map((t) => ({
                cle: t.type, label: libelleType(t.type), valeur: t.ht,
                detail: `${formatNombre(t.n)} facture(s)`,
              }))}
              vide="Aucune facture cette année."
            />
          </Carte>
        )}
        {encaissements && (
          <Carte titre="Encaissements par mode">
            <BarresHorizontales
              items={encaissements.par_mode.map((m) => ({
                cle: m.mode, label: libelleMode(m.mode), valeur: m.total,
                detail: `${formatNombre(m.n)} règlement(s)`, className: "bg-green-500",
              }))}
              vide="Aucun encaissement cette année."
            />
          </Carte>
        )}
      </div>

      {creances && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Carte titre="Créances par ancienneté (reste dû TTC)">
            <BarresHorizontales
              items={creances.tranches.map((t) => ({
                cle: t.cle, label: t.label, valeur: t.total,
                detail: `${formatNombre(t.n)} facture(s)`, className: COULEURS_TRANCHES[t.cle],
              }))}
              vide="Aucune créance en cours."
            />
            <p className="mt-3 text-xs text-muted-foreground">
              Ancienneté calculée à partir de l'échéance de la facture (délai de paiement configuré côté serveur).
            </p>
          </Carte>
          <Carte titre="Créances par mode de paiement">
            <BarresHorizontales
              items={creances.par_mode.map((m) => ({
                cle: m.type_facturation, label: libelleTarifFacturation(m.type_facturation), valeur: m.total,
                detail: `${formatNombre(m.n)} facture(s)`, className: "bg-amber-500",
              }))}
              vide="Aucune créance en cours."
            />
          </Carte>
        </div>
      )}

      {ventes && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Carte titre="Principaux clients (HT facturé)">
            <BarresHorizontales
              items={ventes.top_clients.map((c) => ({
                cle: String(c.client), label: c.nom_client, valeur: c.ht, detail: `${formatNombre(c.n)} facture(s)`,
              }))}
              vide="Aucune facture cette année."
            />
          </Carte>
          <Carte titre="Principaux produits (HT facturé)">
            <BarresHorizontales
              items={ventes.top_produits.map((p) => ({
                cle: String(p.produit), label: p.designation, valeur: p.ca,
                detail: `${p.code_produit} · ${formatNombre(p.quantite)} unité(s)`, className: "bg-violet-500",
              }))}
              vide="Aucune vente cette année."
            />
          </Carte>
        </div>
      )}

      {(ventes || commandes) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {ventes && (
            <Carte titre="Factures de l'année par statut de paiement">
              <ul className="divide-y text-sm">
                {ventes.par_statut_paiement.length === 0 && <li className="py-4 text-center text-muted-foreground">Aucune facture.</li>}
                {ventes.par_statut_paiement.map((s) => (
                  <li key={s.statut} className="flex items-center justify-between py-2">
                    <StatusBadge statut={s.statut} />
                    <span className="tabular-nums">{formatNombre(s.n)} · {formatAr(s.ht)} HT</span>
                  </li>
                ))}
              </ul>
            </Carte>
          )}
          {commandes && (
            <Carte titre="Commandes de l'année par statut">
              <ul className="divide-y text-sm">
                {commandes.par_statut.length === 0 && <li className="py-4 text-center text-muted-foreground">Aucune commande.</li>}
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
        <Carte titre={`Exécution budgétaire ${budget.annee}`}>
          {budget.organismes.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Aucun budget pour cette année.</p>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-4 text-sm sm:grid-cols-4">
                <div><p className="text-xs text-muted-foreground">Alloué</p><p className="font-semibold tabular-nums">{formatAr(budget.alloue)}</p></div>
                <div><p className="text-xs text-muted-foreground">Dotation des lignes</p><p className="font-semibold tabular-nums">{formatAr(budget.dotation)}</p></div>
                <div><p className="text-xs text-muted-foreground">Engagé</p><p className="font-semibold tabular-nums text-amber-600">{formatAr(budget.engage)}</p></div>
                <div><p className="text-xs text-muted-foreground">Disponible</p><p className="font-semibold tabular-nums text-green-700">{formatAr(budget.disponible)}</p></div>
              </div>
              <ul className="space-y-3">
                {budget.organismes.map((o) => (
                  <li key={o.organisme} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="font-medium">{o.organisme}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatAr(o.engage)} engagé sur {formatAr(o.dotation)} · {o.taux} %
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-muted" title={`${o.taux} % engagé`}>
                      <div
                        className={cn("h-full rounded-full", o.taux >= 90 ? "bg-red-500" : o.taux >= 70 ? "bg-amber-500" : "bg-primary")}
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
            <Carte titre="Stock">
              <div className="space-y-3 text-sm">
                <div><p className="text-xs text-muted-foreground">Valeur du stock (au tarif)</p>
                  <p className="text-lg font-semibold tabular-nums">{formatAr(stock.valeur)}</p></div>
                <p>
                  <span className={cn("font-semibold", stock.nb_ruptures > 0 && "text-red-600")}>{stock.nb_ruptures}</span>{" "}
                  produit(s) en rupture ou entièrement réservé(s) · {stock.sans_stock} sans stock enregistré
                </p>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Disponibilités les plus faibles</p>
                  <ul className="divide-y">
                    {stock.plus_faibles.length === 0 && <li className="py-2 text-muted-foreground">Aucun stock.</li>}
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
            <Carte titre={`Production ${data.annee}`}>
              <div className="space-y-3 text-sm">
                <p><span className="text-lg font-semibold">{production.a_faire}</span> lot(s) planifié(s) ou en cours</p>
                <ul className="divide-y">
                  {production.par_statut.length === 0 && <li className="py-2 text-muted-foreground">Aucun lot lancé cette année.</li>}
                  {production.par_statut.map((s) => (
                    <li key={s.statut} className="flex items-center justify-between py-2">
                      <StatusBadge statut={s.statut} />
                      <span className="tabular-nums">{formatNombre(s.n)} lot(s) · {formatNombre(s.quantite)} ex.</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Carte>
          )}
          {recouvrement && (
            <Carte titre="Recouvrement">
              <div className="space-y-3 text-sm">
                <div><p className="text-xs text-muted-foreground">À recouvrer (dossiers actifs)</p>
                  <p className="text-lg font-semibold tabular-nums text-red-600">{formatAr(recouvrement.montant_actif)}</p></div>
                <ul className="divide-y">
                  {recouvrement.par_statut.length === 0 && <li className="py-2 text-muted-foreground">Aucun dossier.</li>}
                  {recouvrement.par_statut.map((s) => (
                    <li key={s.statut} className="flex items-center justify-between py-2">
                      <StatusBadge statut={s.statut} /><span className="tabular-nums">{formatNombre(s.n)}</span>
                    </li>
                  ))}
                </ul>
                {recouvrement.par_niveau.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Dossiers actifs par niveau : {recouvrement.par_niveau.map((n) => `niveau ${n.niveau} : ${n.n}`).join(" · ")}
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