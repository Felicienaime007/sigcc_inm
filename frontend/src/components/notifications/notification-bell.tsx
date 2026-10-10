"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Bell, Info, Siren } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/lib/api";
import {
  CLE_RESUME, bip, marquerLue, notifierBureau, sonActif, tempsRelatif, toutMarquerLu,
} from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/contexte";
import type { NiveauNotif, Notif, ResumeNotifs } from "@/types/notifications";

export function IconeNiveau({ niveau, className }: { niveau: NiveauNotif; className?: string }) {
  const classe = cn("h-4 w-4 shrink-0", className);
  if (niveau === "URGENT") return <Siren className={cn(classe, "text-red-600")} />;
  if (niveau === "ATTENTION") return <AlertTriangle className={cn(classe, "text-amber-600")} />;
  return <Info className={cn(classe, "text-blue-600")} />;
}

/** Cloche de l'en-tête : compteur, liste, et alerte à l'arrivée d'une nouvelle notification. */
export function NotificationBell() {
  const { t, langue } = useT();
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();
  const [ouvert, setOuvert] = useState(false);
  const dernierVu = useRef<number | null>(null);   // dernier identifiant déjà annoncé
  const dejaTraite = useRef<ResumeNotifs | null>(null);

  const { data } = useQuery({
    queryKey: [CLE_RESUME],
    queryFn: async () =>
      (await api.get<ResumeNotifs>("/notifications/resume/", {
        params: dernierVu.current !== null ? { apres: dernierVu.current } : {},
      })).data,
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,   // requête très légère : permet d'alerter onglet masqué
  });

  function ouvrir(n: Notif) {
    void marquerLue(qc, n.id_notification);
    setOuvert(false);
    if (n.lien) router.push(n.lien);
  }

  // Alertes : on n'annonce que ce qui est arrivé après la première lecture
  useEffect(() => {
    if (!data || dejaTraite.current === data) return;
    dejaTraite.current = data;
    if (dernierVu.current === null) {
      dernierVu.current = data.derniere;     // premier chargement : pas de rattrapage de l'historique
      return;
    }
    if (data.nouvelles.length === 0) return;
    dernierVu.current = data.derniere;

    for (const n of data.nouvelles.slice(0, 3)) {
      const options = {
        description: n.message ?? undefined,
        duration: n.niveau === "URGENT" ? 20_000 : 8_000,
        action: { label: "Ouvrir", onClick: () => ouvrir(n) },
      };
      if (n.niveau === "URGENT") toast.error(n.titre, options);
      else if (n.niveau === "ATTENTION") toast.warning(n.titre, options);
      else toast.info(n.titre, options);
      notifierBureau(n.titre, n.message ?? "", () => ouvrir(n));
    }
    if (data.nouvelles.length > 3) toast.info(t("notif.cloche.autres", { n: data.nouvelles.length - 3 }));
    if (sonActif()) bip();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Compteur dans le titre de l'onglet : « (3) SIGCC … »
  const nb = data?.non_lues ?? 0;
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, "");
    document.title = nb > 0 ? `(${nb > 99 ? "99+" : nb}) ${base}` : base;
  }, [nb, pathname]);

  return (
    <Popover open={ouvert} onOpenChange={setOuvert}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" title={t("notif.cloche.titre")}>
          <Bell className="h-5 w-5" />
          {nb > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
              {nb > 99 ? "99+" : nb}
            </span>
          )}
          <span className="sr-only">{t("notif.cloche.titre")}{nb > 0 ? ` (${nb} ${t("notif.cloche.compteur")})` : ""}</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">{t("notif.cloche.titre")}{nb > 0 && <span className="ml-2 font-normal text-muted-foreground">{nb} {t("notif.cloche.compteur")}</span>}</p>
          {nb > 0 && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => void toutMarquerLu(qc)}>
              {t("notif.cloche.tout_marquer")}
            </Button>
          )}
        </div>

        <ul className="max-h-96 divide-y overflow-y-auto">
          {(data?.recentes.length ?? 0) === 0 && (
            <li className="px-4 py-10 text-center text-sm text-muted-foreground">{t("notif.cloche.aucune")}</li>
          )}
          {data?.recentes.map((n) => (
            <li key={n.id_notification}>
              <button
                type="button"
                onClick={() => ouvrir(n)}
                className={cn("flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/50", !n.lu && "bg-primary/5")}
              >
                <IconeNiveau niveau={n.niveau} className="mt-0.5" />
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-sm", !n.lu && "font-semibold")}>{n.titre}</span>
                  {n.message && <span className="block truncate text-xs text-muted-foreground">{n.message}</span>}
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">{tempsRelatif(n.cree_le, langue)}</span>
                </span>
                {!n.lu && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Non lue" />}
              </button>
            </li>
          ))}
        </ul>

        <div className="border-t px-4 py-2 text-center">
          <Link href="/notifications" onClick={() => setOuvert(false)} className="text-xs text-muted-foreground hover:underline">
            {t("notif.cloche.voir_toutes")}
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}