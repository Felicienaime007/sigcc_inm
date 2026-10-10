"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ExternalLink, Megaphone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { DataTable, type Column } from "@/components/data/data-table";
import { FilterSelect } from "@/components/data/filter-select";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { AnnonceDialog } from "@/components/notifications/annonce-dialog";
import { IconeNiveau } from "@/components/notifications/notification-bell";
import { usePagedList } from "@/hooks/use-paged-list";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/i18n/contexte";
import { getErrorMessage } from "@/lib/errors";
import {
  bureauActif, marquerLue, rafraichir, setBureau, setSon, sonActif, tempsRelatif, toutMarquerLu,
} from "@/lib/notifications";
import { useCrud } from "@/lib/resource";
import { cn } from "@/lib/utils";
import type { Notif, TypePreference } from "@/types/notifications";

export default function NotificationsPage() {
  const { t } = useT();
  const { can } = useAuth();
  const [annonce, setAnnonce] = useState(false);

  return (
    <div>
      <PageHeader
        title={t("notif.page.titre")}
        description={t("notif.page.description")}
        action={
          can("notification.annoncer") && (
            <Button onClick={() => setAnnonce(true)}>
              <Megaphone className="mr-2 h-4 w-4" /> {t("notif.page.annonce")}
            </Button>
          )
        }
      />
      <Tabs defaultValue="liste">
        <TabsList>
          <TabsTrigger value="liste">{t("notif.page.onglet_liste")}</TabsTrigger>
          <TabsTrigger value="preferences">{t("notif.page.onglet_prefs")}</TabsTrigger>
        </TabsList>
        <TabsContent value="liste" className="mt-6"><Liste /></TabsContent>
        <TabsContent value="preferences" className="mt-6"><Preferences /></TabsContent>
      </Tabs>
      {annonce && <AnnonceDialog onClose={() => setAnnonce(false)} />}
    </div>
  );
}

// ------------------------------------------------------------------- Historique
function Liste() {
  const { t, langue } = useT();
  const router = useRouter();
  const qc = useQueryClient();
  const liste = usePagedList<Notif>("notifications", { ordering: "-cree_le", refetchInterval: 15_000 });
  const crud = useCrud<Notif>("notifications");
  const [confirmer, setConfirmer] = useState(false);

  async function ouvrir(n: Notif) {
    if (!n.lu) await marquerLue(qc, n.id_notification).catch(() => undefined);
    if (n.lien) router.push(n.lien);
  }

  async function supprimerLues() {
    try {
      const { data } = await api.post<{ supprimees: number }>("/notifications/supprimer-lues/");
      toast.success(t("notif.page.supprimees", { n: data.supprimees }));
      rafraichir(qc);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
    setConfirmer(false);
  }

  const colonnes: Column<Notif>[] = [
    {
      key: "contenu", header: "notif.page.colonne_notif",
      cell: (n) => (
        <div className="flex items-start gap-3">
          <IconeNiveau niveau={n.niveau} className="mt-0.5" />
          <div className="min-w-0">
            <p className={cn("text-sm", !n.lu && "font-semibold")}>{n.titre}</p>
            {n.message && <p className="text-xs text-muted-foreground">{n.message}</p>}
          </div>
        </div>
      ),
    },
    {
      key: "date", header: "notif.page.colonne_recue", sortKey: "cree_le",
      cell: (n) => <span className="whitespace-nowrap text-xs text-muted-foreground">{tempsRelatif(n.cree_le, langue)}</span>,
    },
    {
      key: "etat", header: "notif.page.colonne_etat",
      cell: (n) => (n.lu ? <span className="text-xs text-muted-foreground">{t("notif.page.lue")}</span> : <span className="text-xs font-medium text-primary">{t("notif.page.non_lue")}</span>),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <FilterSelect
          label={t("notif.page.affichage")} className="w-48"
          options={[{ value: "false", label: t("notif.page.non_lues") }, { value: "true", label: t("notif.page.lues") }]}
          value={String(liste.filters.lu ?? "")} onChange={(v) => liste.setFilter("lu", v)}
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void toutMarquerLu(qc)}>
            <Check className="mr-2 h-4 w-4" /> {t("notif.page.tout_lus")}
          </Button>
          <Button variant="outline" onClick={() => setConfirmer(true)}>
            <Trash2 className="mr-2 h-4 w-4" /> {t("notif.page.suppr_lues")}
          </Button>
        </div>
      </div>

      <DataTable
        columns={colonnes}
        data={liste.query.data}
        isLoading={liste.query.isLoading}
        isFetching={liste.query.isFetching}
        error={liste.query.error}
        rowKey={(n) => n.id_notification}
        page={liste.page} pageSize={liste.pageSize} onPageChange={liste.setPage}
        ordering={liste.ordering} onOrderingChange={liste.setOrdering}
        emptyMessage={t("notif.page.vide")}
        actions={(n) => (
          <>
            {n.lien && (
              <Button variant="ghost" size="icon" title={t("notif.page.ouvrir")} onClick={() => void ouvrir(n)}>
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
            {!n.lu && (
              <Button variant="ghost" size="icon" title={t("notif.page.marquer_lue")} onClick={() => void marquerLue(qc, n.id_notification)}>
                <Check className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost" size="icon" title={t("notif.page.supprimer")}
              onClick={() => crud.remove.mutate(n.id_notification, { onSuccess: () => rafraichir(qc) })}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </>
        )}
      />

      <ConfirmDialog
        open={confirmer}
        onOpenChange={setConfirmer}
        title={t("notif.page.confirmer_titre")}
        description={t("notif.page.confirmer_desc")}
        confirmLabel={t("notif.page.confirmer_btn")}
        destructive
        onConfirm={supprimerLues}
      />
    </div>
  );
}

// ------------------------------------------------------------------ Préférences
function Preferences() {
  const { t: tr } = useT();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["notifications/preferences"],
    queryFn: async () => (await api.get<TypePreference[]>("/notifications/preferences/")).data,
  });
  const [son, setSonEtat] = useState(sonActif);
  const [bureau, setBureauEtat] = useState(bureauActif);

  async function basculer(type: string, active: boolean) {
    try {
      await api.post("/notifications/preferences/", { type, active });
      void qc.invalidateQueries({ queryKey: ["notifications/preferences"] });
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }

  async function changerBureau(actif: boolean) {
    const ok = await setBureau(actif);
    setBureauEtat(actif && ok);
    if (actif && !ok) toast.error(tr("notif.prefs.navigateur_refuse"));
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">{tr("notif.prefs.poste")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-start justify-between gap-4">
            <span>
              <span className="block text-sm font-medium">{tr("notif.prefs.son")}</span>
              <span className="block text-xs text-muted-foreground">{tr("notif.prefs.son_desc")}</span>
            </span>
            <Switch checked={son} onCheckedChange={(c) => { setSon(c); setSonEtat(c); }} />
          </label>
          <label className="flex items-start justify-between gap-4">
            <span>
              <span className="block text-sm font-medium">{tr("notif.prefs.navigateur")}</span>
              <span className="block text-xs text-muted-foreground">
                {tr("notif.prefs.navigateur_desc")}
              </span>
            </span>
            <Switch checked={bureau} onCheckedChange={(c) => void changerBureau(c)} />
          </label>
          <p className="text-xs text-muted-foreground">{tr("notif.prefs.propre_navigateur")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{tr("notif.prefs.types")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {isLoading && <p className="text-sm text-muted-foreground">{tr("notif.prefs.chargement")}</p>}
          {data?.map((t) => (
            <label key={t.type} className="flex items-start justify-between gap-4">
              <span>
                <span className="flex items-center gap-2 text-sm font-medium">
                  <IconeNiveau niveau={t.niveau} /> {t.libelle}
                </span>
                <span className="block text-xs text-muted-foreground">{t.description}</span>
              </span>
              <Switch
                checked={t.active}
                disabled={t.obligatoire}
                title={t.obligatoire ? tr("notif.prefs.non_desactivable") : undefined}
                onCheckedChange={(c) => void basculer(t.type, c)}
              />
            </label>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}