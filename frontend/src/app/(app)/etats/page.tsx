"use client";

import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet, FileText, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RequirePrivilege } from "@/components/can";
import { DateRange } from "@/components/data/date-range";
import { FilterSelect } from "@/components/data/filter-select";
import { Pagination } from "@/components/data/pagination";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { anneeCourante } from "@/lib/dates";
import { getErrorMessage } from "@/lib/errors";
import {
  CATALOGUE, PERIODES_RAPIDES, exporter, periodeRapide, valeursParDefaut,
  type EtatDef, type FiltreDef, type FormatExport,
} from "@/lib/etats";
import { formatAr, formatDate, formatDateTime, formatNombre } from "@/lib/format";
import { useT } from "@/lib/i18n/contexte";
import { useOptions } from "@/lib/resource";
import { cn } from "@/lib/utils";
import type { ColonneEtat, Etat, ValeurEtat } from "@/types/etats";

const TAILLE = 50;

export default function EtatsPage() {
  return (
    <RequirePrivilege privilege={CATALOGUE.map((e) => e.privilege)}>
      <Contenu />
    </RequirePrivilege>
  );
}

function Contenu() {
  const { can } = useAuth();
  const { t } = useT();
  const disponibles = CATALOGUE.filter((e) => can(e.privilege));
  const [choix, setChoix] = useState<string | null>(null);
  const actif = disponibles.find((e) => e.code === choix) ?? disponibles[0];

  if (!actif) {
    return (
      <div>
        <PageHeader
          title={t("etats.page.titre")}
          description={t("etats.page.description")}
        />
        <p className="py-10 text-center text-muted-foreground">
          {t("etats.page.inaccessible")}
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t("etats.page.titre")}
        description={t("etats.page.description")}
      />
      <div className="grid gap-6 lg:grid-cols-[17rem_1fr]">
        <nav className="space-y-2" aria-label={t("etats.page.choix")}>
          {disponibles.map((e) => {
            const Icone = e.icone;
            const selectionne = e.code === actif.code;
            return (
              <button
                key={e.code}
                type="button"
                onClick={() => setChoix(e.code)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                  selectionne ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                )}
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icone className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-sm font-medium">{t(e.titre)}</span>
                  <span className="block text-xs text-muted-foreground">{t(e.description)}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <Rapport key={actif.code} def={actif} />
      </div>
    </div>
  );
}

// ----------------------------------------------------------------- Un état
function Rapport({ def }: { def: EtatDef }) {
  const { can } = useAuth();
  const { t } = useT();
  const [valeurs, setValeurs] = useState<Record<string, string>>(() => valeursParDefaut(def));
  const [encours, setEncours] = useState<FormatExport | null>(null);

  const params = useMemo(
    () => Object.fromEntries(Object.entries(valeurs).filter(([, v]) => v !== "")),
    [valeurs],
  );
  const periodeValide = !(def.periode === "plage" && valeurs.du && valeurs.au && valeurs.du > valeurs.au);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["etats", def.code, params],
    queryFn: async () => (await api.get<Etat>(`/etats/${def.code}/`, { params })).data,
    enabled: periodeValide,
    placeholderData: keepPreviousData,
  });

  const modifier = (cle: string, valeur: string) => setValeurs((v) => ({ ...v, [cle]: valeur }));

  async function telecharger(format: FormatExport) {
    setEncours(format);
    try {
      await exporter(def.code, params, format);
    } finally {
      setEncours(null);
    }
  }

  const filtres = def.filtres.filter((f) => !f.privilege || can(f.privilege));
  const annees = [anneeCourante() + 1, anneeCourante(), anneeCourante() - 1, anneeCourante() - 2, anneeCourante() - 3];

  return (
    <div className="min-w-0 space-y-4">
      {/* Critères */}
      <Card>
        <CardContent className="space-y-3 pt-6">
          {def.periode === "plage" && (
            <div className="flex flex-wrap items-center gap-3">
              <DateRange du={valeurs.du ?? ""} au={valeurs.au ?? ""} onChange={modifier} />
              <div className="flex flex-wrap gap-1.5">
                {PERIODES_RAPIDES.map((p) => (
                  <Button key={p.cle} variant="outline" size="sm" onClick={() => setValeurs((v) => ({ ...v, ...periodeRapide(p.cle) }))}>
                    {t(p.label)}
                  </Button>
                ))}
              </div>
            </div>
          )}
          {def.periode === "annee" && (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground">{t("etats.rapport.exercice")}</span>
              <Select value={valeurs.annee ?? String(anneeCourante())} onValueChange={(v) => modifier("annee", v ?? "")}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {annees.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {filtres.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              {filtres.map((f) => (
                <Filtre key={f.cle} def={f} valeur={valeurs[f.cle] ?? ""} onChange={(v) => modifier(f.cle, v)} />
              ))}
            </div>
          )}
          {!periodeValide && (
            <p className="text-sm text-destructive">{t("etats.rapport.periode_invalide")}</p>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{data?.sous_titre}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")} /> {t("etats.rapport.actualiser")}
          </Button>
          <BoutonExport format="xlsx" libelle={t("etats.rapport.excel")} icone={FileSpreadsheet} encours={encours} desactive={!data} onClick={telecharger} />
          <BoutonExport format="csv" libelle="CSV" icone={Download} encours={encours} desactive={!data} onClick={telecharger} />
          <BoutonExport format="pdf" libelle="PDF" icone={FileText} encours={encours} desactive={!data} onClick={telecharger} />
        </div>
      </div>

      {/* Résultat */}
      {isLoading && (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      )}
      {!!error && <p className="py-10 text-center text-destructive">{getErrorMessage(error, t("etats.rapport.erreur"))}</p>}
      {data && !error && <Resultat etat={data} charge={isFetching} />}
    </div>
  );
}

function BoutonExport({
  format, libelle, icone: Icone, encours, desactive, onClick,
}: {
  format: FormatExport;
  libelle: string;
  icone: typeof Download;
  encours: FormatExport | null;
  desactive: boolean;
  onClick: (f: FormatExport) => void;
}) {
  return (
    <Button size="sm" disabled={desactive || encours !== null} onClick={() => onClick(format)}>
      {encours === format ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Icone className="mr-2 h-4 w-4" />}
      {libelle}
    </Button>
  );
}

function Filtre({ def, valeur, onChange }: { def: FiltreDef; valeur: string; onChange: (v: string) => void }) {
  const { t } = useT();
  if (def.type === "select") {
    return <FilterSelect label={t(def.label)} className="w-56" options={(def.options ?? []).map((o) => ({ ...o, label: t(o.label) }))} value={valeur} onChange={onChange} />;
  }
  return <FiltreDistant def={def} valeur={valeur} onChange={onChange} />;
}

function FiltreDistant({ def, valeur, onChange }: { def: FiltreDef; valeur: string; onChange: (v: string) => void }) {
  const { t } = useT();
  const { data } = useOptions<Record<string, string | number>>(def.path ?? "");
  const options = (data ?? []).map((x) => ({ value: String(x[def.idKey ?? ""]), label: String(x[def.labelKey ?? ""]) }));
  return <FilterSelect label={t(def.label)} className="w-60" options={options} value={valeur} onChange={onChange} />;
}

// --------------------------------------------------------------- Affichage
function cellule(c: ColonneEtat, v: ValeurEtat): string {
  if (v === null || v === undefined || v === "") return "";
  switch (c.type) {
    case "montant":
    case "nombre": return formatNombre(v);
    case "pourcent": return `${formatNombre(v)} %`;
    case "date": return formatDate(String(v));
    case "datetime": return formatDateTime(String(v));
    default: return String(v);
  }
}

const numerique = (c: ColonneEtat) => ["montant", "nombre", "pourcent"].includes(c.type);

function Resultat({ etat, charge }: { etat: Etat; charge: boolean }) {
  const { t } = useT();
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(etat.lignes.length / TAILLE));
  const courante = Math.min(page, pages);
  const visibles = etat.lignes.slice((courante - 1) * TAILLE, courante * TAILLE);
  const avecTotaux = Object.keys(etat.totaux).length > 0;

  return (
    <div className={cn("space-y-4", charge && "opacity-70 transition-opacity")}>
      {etat.synthese.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {etat.synthese.map((s) => (
            <div key={s.label} className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{s.montant != null ? formatAr(s.montant) : "—"}</p>
              {s.nombre != null && <p className="text-xs text-muted-foreground">{t("etats.resultat.lignes", { n: formatNombre(s.nombre) })}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {etat.colonnes.map((c) => (
                <TableHead key={c.cle} className={cn(numerique(c) && "text-right", "whitespace-nowrap")}>{c.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibles.length === 0 && (
              <TableRow>
                <TableCell colSpan={etat.colonnes.length} className="py-10 text-center text-muted-foreground">
                  {t("etats.resultat.vide")}
                </TableCell>
              </TableRow>
            )}
            {visibles.map((l, i) => (
              <TableRow key={i}>
                {etat.colonnes.map((c) => {
                  const v = l[c.cle];
                  const nul = c.type === "montant" && Number(v) === 0;
                  return (
                    <TableCell
                      key={c.cle}
                      className={cn(numerique(c) && "text-right tabular-nums", nul && "text-muted-foreground", c.type === "date" && "whitespace-nowrap")}
                    >
                      {cellule(c, v)}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
            {avecTotaux && (
              <TableRow className="bg-muted/50 font-semibold">
                {etat.colonnes.map((c, i) => (
                  <TableCell key={c.cle} className={cn(numerique(c) && "text-right tabular-nums")}>
                    {i === 0 ? t("etats.resultat.total") : c.cle in etat.totaux ? cellule(c, etat.totaux[c.cle]) : ""}
                  </TableCell>
                ))}
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Pagination page={courante} pageSize={TAILLE} count={etat.lignes.length} onPageChange={setPage} />

      {etat.tronque && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          {t("etats.resultat.tronque", { lignes: formatNombre(etat.lignes.length), total: formatNombre(etat.total_lignes) })}
        </p>
      )}
      <p className="text-xs text-muted-foreground">{t("etats.resultat.note_montants")}</p>
    </div>
  );
}
