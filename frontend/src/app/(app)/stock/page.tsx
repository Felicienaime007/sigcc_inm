"use client";

import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowLeftRight, BookmarkPlus, Eye, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RequirePrivilege } from "@/components/can";
import { PageHeader } from "@/components/page-header";
import { DataTable, type Column } from "@/components/data/data-table";
import { FilterSelect } from "@/components/data/filter-select";
import { SearchInput } from "@/components/data/search-input";
import { DetailProduitDialog } from "@/components/stock/detail-produit-dialog";
import { MouvementDialog } from "@/components/stock/mouvement-dialog";
import { ReservationDialog } from "@/components/stock/reservation-dialog";
import { TransfertDialog } from "@/components/stock/transfert-dialog";
import { useDebounce } from "@/hooks/use-debounce";
import { usePagedList } from "@/hooks/use-paged-list";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/i18n/contexte";
import { formatNombre } from "@/lib/format";
import { useOptions } from "@/lib/resource";
import { cn } from "@/lib/utils";
import type { Paginated } from "@/types/api";
import type { Categorie } from "@/types/produits";
import type { LigneStock, Magasin, ProduitRef, ResumeStock } from "@/types/stock";

const TAILLE = 20;

type Dialogue =
  | { type: "mouvement" | "transfert" | "reservation"; produit: ProduitRef | null }
  | { type: "detail"; resume: ResumeStock }
  | null;

const versRef = (r: ResumeStock): ProduitRef => ({
  id_produit: r.produit, code_produit: r.code_produit, designation: r.designation,
});

export default function StockPage() {
  return (
    <RequirePrivilege privilege="stock.view">
      <Contenu />
    </RequirePrivilege>
  );
}

function Contenu() {
  const { can } = useAuth();
  const { t } = useT();
  const [onglet, setOnglet] = useState("produits");
  const [dialogue, setDialogue] = useState<Dialogue>(null);

  return (
    <div>
      <PageHeader
        title={t("stock.niveaux.titre")}
        description={t("stock.niveaux.description")}
        action={
          <div className="flex flex-wrap gap-2">
            {can("stock.transfer") && (
              <Button variant="outline" onClick={() => setDialogue({ type: "transfert", produit: null })}>
                <ArrowLeftRight className="mr-2 h-4 w-4" /> {t("stock.niveaux.btn_transferer")}
              </Button>
            )}
            {can("mouvement.create") && (
              <Button onClick={() => setDialogue({ type: "mouvement", produit: null })}>
                <SlidersHorizontal className="mr-2 h-4 w-4" /> {t("stock.niveaux.btn_mouvement")}
              </Button>
            )}
          </div>
        }
      />

      <Tabs value={onglet} onValueChange={setOnglet}>
        <TabsList>
          <TabsTrigger value="produits">{t("stock.niveaux.onglet_produits")}</TabsTrigger>
          <TabsTrigger value="emplacements">{t("stock.niveaux.onglet_emplacements")}</TabsTrigger>
        </TabsList>
        <TabsContent value="produits" className="mt-6">
          <ParProduit
            ouvrir={(type, r) =>
              setDialogue(type === "detail" ? { type, resume: r } : { type, produit: versRef(r) })
            }
          />
        </TabsContent>
        <TabsContent value="emplacements" className="mt-6"><ParEmplacement /></TabsContent>
      </Tabs>

      {dialogue?.type === "mouvement" && <MouvementDialog produit={dialogue.produit} onClose={() => setDialogue(null)} />}
      {dialogue?.type === "transfert" && <TransfertDialog produit={dialogue.produit} onClose={() => setDialogue(null)} />}
      {dialogue?.type === "reservation" && <ReservationDialog produit={dialogue.produit} onClose={() => setDialogue(null)} />}
      {dialogue?.type === "detail" && <DetailProduitDialog resume={dialogue.resume} onClose={() => setDialogue(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------- Par produit
function ParProduit({
  ouvrir,
}: {
  ouvrir: (type: "mouvement" | "transfert" | "reservation" | "detail", r: ResumeStock) => void;
}) {
  const { can } = useAuth();
  const { t } = useT();
  const [saisie, setSaisie] = useState("");
  const search = useDebounce(saisie, 300);
  const [categorie, setCategorie] = useState("");
  const [magasin, setMagasin] = useState("");
  const [alerte, setAlerte] = useState("");
  const [page, setPage] = useState(1);
  const [ordering, setOrdering] = useState("code_produit");

  const categories = useOptions<Categorie>("produits/categories", {}, can("categorie.view"));
  const magasins = useOptions<Magasin>("stock/magasins", {}, can("magasin.view"));

  const params = Object.fromEntries(
    Object.entries({ search, categorie, magasin, alerte }).filter(([, v]) => v !== ""),
  );
  const resume = useQuery({
    queryKey: ["stock/lignes", "resume", params],
    queryFn: async () => (await api.get<ResumeStock[]>("/stock/lignes/resume/", { params })).data,
    placeholderData: keepPreviousData,
    refetchInterval: 15_000,
  });

  useEffect(() => setPage(1), [search, categorie, magasin, alerte]);

  const trie = useMemo(() => {
    const lignes = [...(resume.data ?? [])];
    if (!ordering) return lignes;
    const desc = ordering.startsWith("-");
    const cle = ordering.replace(/^-/, "") as keyof ResumeStock;
    lignes.sort((a, b) => {
      const x = a[cle];
      const y = b[cle];
      const r = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "fr");
      return desc ? -r : r;
    });
    return lignes;
  }, [resume.data, ordering]);

  const pages = Math.max(1, Math.ceil(trie.length / TAILLE));
  const courante = Math.min(page, pages);
  const donnees: Paginated<ResumeStock> = {
    count: trie.length, next: null, previous: null,
    results: trie.slice((courante - 1) * TAILLE, courante * TAILLE),
  };

  const colonnes: Column<ResumeStock>[] = [
    {
      key: "produit", header: "stock.niveaux.col_produit", sortKey: "code_produit",
      cell: (r) => (
        <div>
          <p className="font-medium">{r.designation}</p>
          <p className="text-xs text-muted-foreground">{r.code_produit}</p>
        </div>
      ),
    },
    { key: "phys", header: "stock.niveaux.col_physique", sortKey: "quantite_physique", className: "text-right tabular-nums", cell: (r) => formatNombre(r.quantite_physique) },
    { key: "resa", header: "stock.niveaux.col_reserve", sortKey: "quantite_reservee", className: "text-right tabular-nums", cell: (r) => formatNombre(r.quantite_reservee) },
    {
      key: "dispo", header: "stock.niveaux.col_disponible", sortKey: "quantite_disponible", className: "text-right",
      cell: (r) => (
        <span className="inline-flex items-center justify-end gap-2">
          {r.quantite_disponible <= 0 && (
            <Badge variant={r.quantite_physique > 0 ? "outline" : "destructive"} className="text-[10px]">
              {r.quantite_physique > 0 ? t("stock.niveaux.badge_tout_reserve") : t("stock.niveaux.badge_rupture")}
            </Badge>
          )}
          {r.quantite_disponible > 0 && r.en_alerte && (
            <Badge variant="outline" className="border-amber-500 text-[10px] text-amber-700">
              {t("stock.niveaux.badge_sous_seuil", { seuil: formatNombre(r.seuil_alerte) })}
            </Badge>
          )}
          <span className={cn("font-semibold tabular-nums", r.quantite_disponible <= 0 && "text-red-600")}>
            {formatNombre(r.quantite_disponible)}
          </span>
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={saisie} onChange={setSaisie} placeholder={t("stock.niveaux.ph_recherche")} />
        {can("categorie.view") && (
          <FilterSelect
            label={t("stock.niveaux.filtre_categorie")} className="w-52"
            options={(categories.data ?? []).map((c) => ({ value: String(c.id_categorie), label: c.libelle_categorie }))}
            value={categorie} onChange={setCategorie}
          />
        )}
        {can("magasin.view") && (
          <FilterSelect
            label={t("stock.niveaux.filtre_magasin")} className="w-52"
            options={(magasins.data ?? []).map((m) => ({ value: String(m.id_magasin), label: `${m.code_depot} — ${m.nom_magasin}` }))}
            value={magasin} onChange={setMagasin}
          />
        )}
        <FilterSelect
          label={t("stock.niveaux.filtre_alertes")} className="w-52"
          options={[{ value: "true", label: t("stock.niveaux.opt_sous_seuil") }]}
          value={alerte} onChange={setAlerte}
        />
      </div>

      <DataTable
        columns={colonnes}
        data={donnees}
        isLoading={resume.isLoading}
        isFetching={resume.isFetching}
        error={resume.error}
        rowKey={(r) => r.produit}
        page={courante} pageSize={TAILLE} onPageChange={setPage}
        ordering={ordering} onOrderingChange={setOrdering}
        emptyMessage="stock.niveaux.vide_produits"
        actions={(r) => (
          <>
            <Button variant="ghost" size="icon" title={t("stock.niveaux.act_detail")} aria-label={t("stock.niveaux.act_detail")} onClick={() => ouvrir("detail", r)}>
              <Eye className="h-4 w-4" />
            </Button>
            {can("mouvement.create") && (
              <Button variant="ghost" size="icon" title={t("stock.niveaux.act_mouvement")} aria-label={t("stock.niveaux.act_mouvement")} onClick={() => ouvrir("mouvement", r)}>
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            )}
            {can("stock.transfer") && (
              <Button variant="ghost" size="icon" title={t("stock.niveaux.act_transferer")} aria-label={t("stock.niveaux.act_transferer")} onClick={() => ouvrir("transfert", r)}>
                <ArrowLeftRight className="h-4 w-4" />
              </Button>
            )}
            {can("reservation.create") && (
              <Button variant="ghost" size="icon" title={t("stock.niveaux.act_reserver")} aria-label={t("stock.niveaux.act_reserver")} onClick={() => ouvrir("reservation", r)}>
                <BookmarkPlus className="h-4 w-4" />
              </Button>
            )}
          </>
        )}
      />
    </div>
  );
}

// ------------------------------------------------------------- Par emplacement
function ParEmplacement() {
  const { can } = useAuth();
  const { t } = useT();
  const liste = usePagedList<LigneStock>("stock/lignes", { ordering: "produit__code_produit", refetchInterval: 15_000 });
  const magasins = useOptions<Magasin>("stock/magasins", {}, can("magasin.view"));

  const colonnes: Column<LigneStock>[] = [
    { key: "depot", header: "stock.niveaux.col_depot", sortKey: "emplacement__magasin__code_depot", cell: (l) => l.code_depot },
    { key: "empl", header: "stock.niveaux.col_emplacement", cell: (l) => `${l.code_allee} · ${l.code_etagere}` },
    {
      key: "produit", header: "stock.niveaux.col_produit", sortKey: "produit__code_produit",
      cell: (l) => (
        <div>
          <p className="font-medium">{l.designation}</p>
          <p className="text-xs text-muted-foreground">{l.code_produit}</p>
        </div>
      ),
    },
    { key: "phys", header: "stock.niveaux.col_physique", sortKey: "quantite_physique", className: "text-right tabular-nums", cell: (l) => formatNombre(l.quantite_physique) },
    { key: "resa", header: "stock.niveaux.col_reserve", sortKey: "quantite_reservee", className: "text-right tabular-nums", cell: (l) => formatNombre(l.quantite_reservee) },
    {
      key: "dispo", header: "stock.niveaux.col_disponible", className: "text-right font-semibold tabular-nums",
      cell: (l) => <span className={l.quantite_disponible <= 0 ? "text-red-600" : ""}>{formatNombre(l.quantite_disponible)}</span>,
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={liste.searchInput} onChange={liste.setSearchInput} placeholder={t("stock.niveaux.ph_recherche")} />
        {can("magasin.view") && (
          <FilterSelect
            label={t("stock.niveaux.filtre_magasin")} className="w-52"
            options={(magasins.data ?? []).map((m) => ({ value: String(m.id_magasin), label: `${m.code_depot} — ${m.nom_magasin}` }))}
            value={String(liste.filters.magasin ?? "")}
            onChange={(v) => liste.setFilter("magasin", v)}
          />
        )}
      </div>
      <DataTable
        columns={colonnes}
        data={liste.query.data}
        isLoading={liste.query.isLoading}
        isFetching={liste.query.isFetching}
        error={liste.query.error}
        rowKey={(l) => l.id}
        page={liste.page} pageSize={liste.pageSize} onPageChange={liste.setPage}
        ordering={liste.ordering} onOrderingChange={liste.setOrdering}
        emptyMessage="stock.niveaux.vide_emplacements"
      />
    </div>
  );
}
