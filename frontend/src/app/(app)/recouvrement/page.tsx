"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, FolderPlus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RequirePrivilege } from "@/components/can";
import { PageHeader } from "@/components/page-header";
import { DataTable, type Column } from "@/components/data/data-table";
import { DateRange } from "@/components/data/data-range";
import { FilterSelect } from "@/components/data/filter-select";
import { SearchInput } from "@/components/data/search-input";
import { StatusBadge } from "@/components/data/status-badge";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { NiveauBadge } from "@/components/recouvrement/niveau-badge";
import { usePagedList } from "@/hooks/use-paged-list";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatAr, formatDate, formatNombre } from "@/lib/format";
import { NIVEAUX, STATUTS_DOSSIER } from "@/lib/recouvrement";
import { useApiMutation, useList } from "@/lib/resource";
import { cn } from "@/lib/utils";
import type { Paginated } from "@/types/api";
import type { Dossier, Impaye } from "@/types/recouvrement";

const KEY_IMPAYES = "recouvrement/dossiers/impayes";
const TAILLE = 15;

export default function RecouvrementPage() {
  return (
    <RequirePrivilege privilege="recouvrement.view">
      <Contenu />
    </RequirePrivilege>
  );
}

function Contenu() {
  const [onglet, setOnglet] = useState("impayes");
  return (
    <div>
      <PageHeader
        title="Recouvrement"
        description="Factures privées impayées à échéance, dossiers de relance par paliers et contentieux."
      />
      <Compteurs />
      <Tabs value={onglet} onValueChange={setOnglet} className="mt-6">
        <TabsList>
          <TabsTrigger value="impayes">Impayés échus</TabsTrigger>
          <TabsTrigger value="dossiers">Dossiers</TabsTrigger>
        </TabsList>
        <TabsContent value="impayes" className="mt-6"><ImpayesTab /></TabsContent>
        <TabsContent value="dossiers" className="mt-6"><DossiersTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// -------------------------------------------------------------------- Compteurs
function Kpi({ label, valeur, ton }: { label: string; valeur: string; ton?: string }) {
  return (
    <Card>
      <CardContent className="space-y-1 pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={cn("text-2xl font-semibold tabular-nums", ton)}>{valeur}</p>
      </CardContent>
    </Card>
  );
}

function Compteurs() {
  const echus = useQuery({
    queryKey: [KEY_IMPAYES, "kpi"],
    queryFn: async () => (await api.get<Impaye[]>(`/${KEY_IMPAYES}/`)).data,
    refetchInterval: 30_000,
  });
  const enCours = useList<Dossier>("recouvrement/dossiers", { statut: "EN_COURS", page_size: 1 });
  const contentieux = useList<Dossier>("recouvrement/dossiers", { statut: "CONTENTIEUX", page_size: 1 });
  const montant = (echus.data ?? []).reduce((s, i) => s + Number(i.montant_du), 0);
  const n = (v?: number) => (v === undefined ? "—" : formatNombre(v));

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi label="Factures échues sans dossier" valeur={n(echus.data?.length)} ton={(echus.data?.length ?? 0) > 0 ? "text-red-600" : ""} />
      <Kpi label="Montant échu" valeur={echus.data ? formatAr(montant) : "—"} ton={montant > 0 ? "text-red-600" : ""} />
      <Kpi label="Dossiers en cours" valeur={n(enCours.data?.count)} ton={(enCours.data?.count ?? 0) > 0 ? "text-amber-600" : ""} />
      <Kpi label="Dossiers en contentieux" valeur={n(contentieux.data?.count)} ton={(contentieux.data?.count ?? 0) > 0 ? "text-red-600" : ""} />
    </div>
  );
}

// ----------------------------------------------------------------- Impayés échus
function comparer(a: Impaye, b: Impaye, cle: keyof Impaye): number {
  if (cle === "jours_retard" || cle === "montant_du") return Number(a[cle]) - Number(b[cle]);
  return String(a[cle]).localeCompare(String(b[cle]), "fr");
}

function ImpayesTab() {
  const { can } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const peutOuvrir = can("recouvrement.create");

  const [tous, setTous] = useState(false);
  const [saisie, setSaisie] = useState("");
  const [page, setPage] = useState(1);
  const [ordering, setOrdering] = useState("-jours_retard");
  const [selection, setSelection] = useState<Set<number>>(new Set());
  const [confirmer, setConfirmer] = useState(false);

  const impayes = useQuery({
    queryKey: [KEY_IMPAYES, { tous }],
    queryFn: async () =>
      (await api.get<Impaye[]>(`/${KEY_IMPAYES}/`, { params: tous ? { tous: "true" } : {} })).data,
    refetchInterval: 30_000,
  });

  const ouvrir = useApiMutation(
    async (ids: number[]) => (await api.post<Dossier>("/recouvrement/dossiers/", { factures: ids })).data,
    { success: "Dossier de recouvrement ouvert." },
  );

  // Une facture qui disparaît de la liste (réglée, mise en dossier ailleurs) quitte la sélection
  useEffect(() => {
    if (!impayes.data) return;
    const presentes = new Set(impayes.data.map((i) => i.facture));
    setSelection((s) => {
      const gardees = [...s].filter((id) => presentes.has(id));
      return gardees.length === s.size ? s : new Set(gardees);
    });
  }, [impayes.data]);

  useEffect(() => setPage(1), [saisie, tous]);

  const toutes = impayes.data ?? [];
  const choisies = toutes.filter((i) => selection.has(i.facture));
  const clientSel = choisies[0]?.client ?? null;
  const nomClient = choisies[0]?.nom_client ?? "";
  const totalSel = choisies.reduce((s, i) => s + Number(i.montant_du), 0);

  const filtrees = useMemo(() => {
    const f = saisie.trim().toLowerCase();
    const lignes = f
      ? toutes.filter((i) => i.nom_client.toLowerCase().includes(f) || i.num_facture.toLowerCase().includes(f))
      : [...toutes];
    if (ordering) {
      const desc = ordering.startsWith("-");
      const cle = ordering.replace(/^-/, "") as keyof Impaye;
      lignes.sort((a, b) => (desc ? -1 : 1) * comparer(a, b, cle));
    }
    return lignes;
  }, [toutes, saisie, ordering]);

  const pages = Math.max(1, Math.ceil(filtrees.length / TAILLE));
  const courante = Math.min(page, pages);
  const donnees: Paginated<Impaye> = {
    count: filtrees.length, next: null, previous: null,
    results: filtrees.slice((courante - 1) * TAILLE, courante * TAILLE),
  };

  function basculer(i: Impaye, coche: boolean) {
    setSelection((s) => {
      const suite = new Set(s);
      if (coche) suite.add(i.facture);
      else suite.delete(i.facture);
      return suite;
    });
  }

  function toutDuClient() {
    if (clientSel === null) return;
    setSelection(new Set(toutes.filter((i) => i.client === clientSel && i.jours_retard > 0).map((i) => i.facture)));
  }

  async function confirmerOuverture() {
    try {
      const dossier = await ouvrir.mutateAsync([...selection]);
      setSelection(new Set());
      setConfirmer(false);
      router.push(`/recouvrement/${dossier.id_recouvrement}`);
    } catch {
      // Refus du serveur (déjà en dossier, soldée entre-temps…) : on actualise la liste
      setConfirmer(false);
      void qc.invalidateQueries({ queryKey: [KEY_IMPAYES] });
    }
  }

  const colonnes: Column<Impaye>[] = [
    ...(peutOuvrir
      ? [{
          key: "choix", header: "", className: "w-10",
          cell: (i: Impaye) => (
            <Checkbox
              aria-label={`Sélectionner ${i.num_facture}`}
              checked={selection.has(i.facture)}
              disabled={i.jours_retard === 0 || (clientSel !== null && i.client !== clientSel)}
              onCheckedChange={(c) => basculer(i, c === true)}
            />
          ),
        }]
      : []),
    {
      key: "facture", header: "Facture", sortKey: "num_facture",
      cell: (i) =>
        can("facture.view")
          ? <Link href={`/commercial/factures/${i.facture}`} className="font-medium hover:underline">{i.num_facture}</Link>
          : <span className="font-medium">{i.num_facture}</span>,
    },
    { key: "client", header: "Client", sortKey: "nom_client", cell: (i) => i.nom_client },
    { key: "date", header: "Émise le", sortKey: "date_facture", cell: (i) => formatDate(i.date_facture) },
    { key: "echeance", header: "Échéance", cell: (i) => formatDate(i.echeance) },
    {
      key: "retard", header: "Retard", sortKey: "jours_retard", className: "text-right tabular-nums",
      cell: (i) =>
        i.jours_retard === 0 ? <Badge variant="outline">Non échue</Badge>
          : <span className="font-medium text-red-600">{i.jours_retard} j</span>,
    },
    {
      key: "du", header: "Reste dû", sortKey: "montant_du", className: "text-right font-semibold tabular-nums",
      cell: (i) => formatAr(i.montant_du),
    },
    { key: "statut", header: "Paiement", cell: (i) => <StatusBadge statut={i.statut_paiement} /> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <SearchInput value={saisie} onChange={setSaisie} placeholder="Client ou n° de facture…" />
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={tous} onCheckedChange={(c) => setTous(c === true)} />
          Inclure les factures non échues
        </label>
      </div>

      {peutOuvrir && selection.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/40 p-3 text-sm">
          <p>
            <span className="font-medium">{selection.size} facture(s)</span> de{" "}
            <span className="font-medium">{nomClient}</span> · total{" "}
            <span className="font-semibold tabular-nums">{formatAr(totalSel)}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={toutDuClient}>Toutes ses factures échues</Button>
            <Button variant="ghost" size="sm" onClick={() => setSelection(new Set())}>
              <X className="mr-1 h-4 w-4" /> Désélectionner
            </Button>
            <Button size="sm" onClick={() => setConfirmer(true)}>
              <FolderPlus className="mr-2 h-4 w-4" /> Ouvrir un dossier
            </Button>
          </div>
        </div>
      )}

      <DataTable
        columns={colonnes}
        data={donnees}
        isLoading={impayes.isLoading}
        isFetching={impayes.isFetching}
        error={impayes.error}
        rowKey={(i) => i.facture}
        page={courante} pageSize={TAILLE} onPageChange={setPage}
        ordering={ordering} onOrderingChange={setOrdering}
        emptyMessage={tous ? "Aucun impayé." : "Aucune facture échue sans dossier de recouvrement."}
      />
      {peutOuvrir && (
        <p className="text-xs text-muted-foreground">
          Cochez des factures d'un même client pour ouvrir un dossier. Les factures d'un autre client se désactivent.
        </p>
      )}

      <ConfirmDialog
        open={confirmer}
        onOpenChange={setConfirmer}
        title="Ouvrir un dossier de recouvrement ?"
        description={`${selection.size} facture(s) de ${nomClient}, pour un total de ${formatAr(totalSel)}. Le dossier démarre au niveau 1 (amiable).`}
        confirmLabel="Ouvrir le dossier"
        loading={ouvrir.isPending}
        onConfirm={confirmerOuverture}
      />
    </div>
  );
}

// ---------------------------------------------------------------------- Dossiers
function DossiersTab() {
  const liste = usePagedList<Dossier>("recouvrement/dossiers", { ordering: "-date_relance", refetchInterval: 30_000 });

  const colonnes: Column<Dossier>[] = [
    {
      key: "num", header: "Dossier", sortKey: "num_dossier",
      cell: (d) => <Link href={`/recouvrement/${d.id_recouvrement}`} className="font-medium hover:underline">{d.num_dossier}</Link>,
    },
    { key: "client", header: "Client", cell: (d) => d.nom_client ?? "—" },
    { key: "factures", header: "Factures", className: "text-right tabular-nums", cell: (d) => d.lignes.length },
    {
      key: "total", header: "Reste à recouvrer", className: "text-right tabular-nums font-semibold",
      cell: (d) => formatAr(d.total_a_recouvrer),
    },
    { key: "niveau", header: "Niveau", sortKey: "niveau_relance", cell: (d) => <NiveauBadge niveau={d.niveau_relance} /> },
    { key: "relance", header: "Dernière relance", sortKey: "date_relance", cell: (d) => formatDate(d.date_relance) },
    { key: "statut", header: "Statut", sortKey: "statut_dossier", cell: (d) => <StatusBadge statut={d.statut_dossier} /> },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={liste.searchInput} onChange={liste.setSearchInput} placeholder="N° de dossier, client ou facture…" />
        <FilterSelect
          label="Statut" options={STATUTS_DOSSIER}
          value={String(liste.filters.statut ?? "")} onChange={(v) => liste.setFilter("statut", v)}
        />
        <FilterSelect
          label="Niveau" className="w-52" options={NIVEAUX}
          value={String(liste.filters.niveau ?? "")} onChange={(v) => liste.setFilter("niveau", v)}
        />
        <DateRange
          du={String(liste.filters.du ?? "")} au={String(liste.filters.au ?? "")}
          onChange={(cle, v) => liste.setFilter(cle, v)}
        />
      </div>

      <DataTable
        columns={colonnes}
        data={liste.query.data}
        isLoading={liste.query.isLoading}
        isFetching={liste.query.isFetching}
        error={liste.query.error}
        rowKey={(d) => d.id_recouvrement}
        page={liste.page} pageSize={liste.pageSize} onPageChange={liste.setPage}
        ordering={liste.ordering} onOrderingChange={liste.setOrdering}
        emptyMessage="Aucun dossier de recouvrement."
        actions={(d) => (
          <Link href={`/recouvrement/${d.id_recouvrement}`} className={buttonVariants({ variant: "ghost", size: "icon" })} title="Ouvrir le dossier"><Eye className="h-4 w-4" /></Link>
        )}
      />
    </div>
  );
}