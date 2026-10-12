"use client";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { useTheme } from "@/components/theme-provider";
import { UserRound } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, LogOut, Menu, Moon, PanelLeft, Search, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/kbd";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { AvatarUtilisateur } from "@/components/users/avatar-utilisateur";
import { useAuth } from "@/lib/auth-context";
import { NAV } from "@/config/nav";
import { SidebarNav } from "./sidebar-nav";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { PaletteCommande } from "@/components/recherche/palette-commande";
import { useT } from "@/lib/i18n/contexte";
import { SelecteurLangue } from "@/components/i18n/selecteur-langue";
import logo from "@/app/assets/image/logo-inm.png";

function Marque({ repliee = false }: { repliee?: boolean }) {
  if (repliee) {
    return (
      <div className="flex h-16 shrink-0 items-center justify-center border-b border-white/10 bg-white/5 px-2">
        <span className="flex h-10 w-12 shrink-0 items-center justify-center rounded-lg bg-white p-1 shadow-md" title="SIGCC">
          <Image
            src={logo}
            alt="Imprimerie Nationale de Madagascar"
            width={72}
            height={36}
            className="h-full w-auto object-contain"
            priority
          />
        </span>
      </div>
    );
  }
  return (
    <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 bg-white/5 px-4 text-white">
      <span className="flex h-10 w-16 shrink-0 items-center justify-center rounded-lg bg-white p-1 shadow-md">
        <Image
          src={logo}
          alt="Imprimerie Nationale de Madagascar"
          width={72}
          height={36}
          className="h-full w-auto object-contain"
          priority
        />
      </span>
      <span className="leading-tight">
        <span className="block text-[15px] font-bold tracking-tight">SIGCC</span>
        <span className="block text-[11px] font-medium text-white/65">Imprimerie Nationale</span>
      </span>
      <span className="ml-auto rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/85">
        v1.0
      </span>
    </div>
  );
}

function BoutonTheme() {
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useT();
  const sombre = resolvedTheme === "dark";
  return (
    <Button
      variant="ghost" size="icon" className="h-8 w-8 shrink-0"
      title={sombre ? t("shell.theme_clair") : t("shell.theme_sombre")}
      aria-label={sombre ? t("shell.theme_clair") : t("shell.theme_sombre")}
      onClick={() => setTheme(sombre ? "light" : "dark")}
    >
      {sombre ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

function useFilAriane(pathname: string): { label: string }[] {
  const { t } = useT();
  return useMemo(() => {
    if (pathname === "/") return [{ label: t("shell.tableau_de_bord") }];
    const chemin: string = pathname;
    const tous = NAV.flatMap((g) => g.items.map((i) => ({ ...i, groupe: g.label })));
    // entrée exacte d'abord, sinon préfixe le plus long
    const exacte = tous.find((i) => i.href === chemin);
    if (exacte) return [{ label: t(exacte.groupe) }, { label: t(exacte.label) }];
    const prefixe = tous.filter((i) => i.href !== "/" && chemin.startsWith(`${i.href}/`)).sort((a, b) => b.href.length - a.href.length)[0];
    if (prefixe) return [{ label: t(prefixe.groupe) }, { label: t(prefixe.label) }, { label: t("shell.detail") }];
    // repli : segments lisibles
    return chemin
      .split("/")
      .filter(Boolean)
      .map((s: string) => ({ label: s.replace(/-/g, " ").replace(/^\w/, (c: string) => c.toUpperCase()) }));
  }, [pathname, t]);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [paletteOuverte, setPaletteOuverte] = useState(false);
  const [repliee, setRepliee] = useState(false);
  const fil = useFilAriane(pathname);

  // Recherche globale Ctrl+K / Cmd+K + repli sidebar avec Ctrl/Cmd+B.
  useEffect(() => {
    function onTouche(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOuverte((o) => !o);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        basculerSidebar();
      }
    }
    window.addEventListener("keydown", onTouche);
    return () => window.removeEventListener("keydown", onTouche);
  }, []);

  // Sidebar repliable persistée (en-tête uniquement, évite tout décalage d'hydratation).
  useEffect(() => {
    try {
      if (window.localStorage.getItem("sigcc_sidebar_repliee") === "1") setRepliee(true);
    } catch {
      /* stockage indisponible : on ignore */
    }
  }, []);

  function basculerSidebar() {
    setRepliee((v) => {
      try {
        window.localStorage.setItem("sigcc_sidebar_repliee", v ? "0" : "1");
      } catch {
        /* stockage indisponible : on ignore */
      }
      return !v;
    });
  }

  // Titre de l'onglet : le layout (app) est client, generateMetadata y est impossible.
  useEffect(() => {
    const page = fil.length > 0 ? fil[fil.length - 1].label : "SIGCC";
    document.title = `${page} – SIGCC · Imprimerie Nationale`;
  }, [fil]);

  return (
    <div className="app-bg flex min-h-screen bg-muted/20">
      {/* Menu fixe dès la tablette (md) : bleu marine permanent, insensible au mode clair/sombre */}
      <aside className={cn("sticky top-0 hidden h-screen shrink-0 flex-col border-r border-[#0a1230] bg-gradient-to-b from-[#1a2757] via-[#1d2c5e] to-[#121c46] text-white shadow-[8px_0_24px_-16px_rgb(0_0_0/0.5)] transition-[width] duration-200 md:flex", repliee ? "w-[76px]" : "w-64 xl:w-72")}>
        <Marque repliee={repliee} />
        <div className="scrollbar-sidebar flex-1 overflow-y-auto overflow-x-hidden">
          <SidebarNav repliee={repliee} />
        </div>
        <div className="shrink-0 border-t border-white/10 p-3">
          {repliee ? (
            <div className="flex flex-col items-center gap-2">
              <span className="relative shrink-0" title={user?.nom_complet ?? ""}>
                <AvatarUtilisateur photo={user?.photo ?? null} nom={user?.nom_complet} taille="sm" className="bg-[#2c3f7d] text-white ring-2 ring-white/30" />
                <span aria-hidden className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full bg-green-400 ring-2 ring-[#1d2c5e]" />
              </span>
              <button
                type="button"
                title={t("shell.deconnexion")} aria-label={t("shell.deconnexion")} onClick={() => logout()}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/80 outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
          <div className="flex items-center gap-3 rounded-xl bg-white/10 px-3 py-2.5 ring-1 ring-white/15">
            <span className="relative shrink-0">
              <AvatarUtilisateur photo={user?.photo ?? null} nom={user?.nom_complet} taille="sm" className="bg-[#2c3f7d] text-white ring-2 ring-white/30" />
              <span aria-hidden className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full bg-green-400 ring-2 ring-[#1d2c5e]" />
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[13px] font-medium text-white">{user?.nom_complet ?? "—"}</span>
              <span className="block truncate text-[11px] text-white/65">
                {user?.roles?.[0] ?? user?.identifiant ?? ""}
                {user && user.roles.length > 1 ? ` +${user.roles.length - 1}` : ""}
              </span>
            </span>
            <button
              type="button"
              title={t("shell.deconnexion")} aria-label={t("shell.deconnexion")} onClick={() => logout()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/80 outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <LogOut className="h-4 w-4" />
              <span className="sr-only">{t("shell.deconnexion")}</span>
            </button>
          </div>
          )}
        </div>
      </aside>

      {/* Menu coulissant sur mobile : même bleu marine permanent */}
      <Sheet open={menuOuvert} onOpenChange={setMenuOuvert}>
        <SheetContent side="left" className="flex w-72 max-w-[85vw] flex-col overflow-hidden border-[#0a1230] bg-gradient-to-b from-[#1a2757] via-[#1d2c5e] to-[#121c46] p-0 text-white">
          <SheetTitle className="sr-only">{t("shell.menu")}</SheetTitle>
          <Marque />
          <div className="scrollbar-sidebar flex-1 overflow-y-auto">
            <SidebarNav onNavigate={() => setMenuOuvert(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-1.5 border-b bg-background/85 px-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)] backdrop-blur-xl sm:gap-2 sm:px-4 md:h-16">
          <Button
            variant="ghost" size="icon" className="shrink-0 md:hidden"
            title={t("shell.ouvrir_menu")} aria-label={t("shell.ouvrir_menu")}
            onClick={() => setMenuOuvert(true)}
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">{t("shell.ouvrir_menu")}</span>
          </Button>
          <Button
            variant="ghost" size="icon" className="hidden h-8 w-8 shrink-0 md:flex"
            title={repliee ? t("shell.deplier") : t("shell.replier")}
            aria-label={repliee ? t("shell.deplier") : t("shell.replier")}
            aria-expanded={!repliee}
            onClick={basculerSidebar}
          >
            <PanelLeft className="h-5 w-5" />
          </Button>

          {/* Fil d'Ariane */}
          <nav aria-label={t("shell.fil_ariane")} className="hidden min-w-0 items-center gap-1 text-sm sm:flex">
            {fil.map((miette: { label: string }, i: number) => (
              <Fragment key={`${miette.label}-${i}`}>
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" aria-hidden />}
                <span
                  className={
                    i === fil.length - 1
                      ? "max-w-44 truncate rounded-md bg-primary/10 px-2 py-0.5 font-semibold text-primary lg:max-w-64"
                      : "hidden shrink-0 text-muted-foreground lg:block"
                  }
                >
                  {miette.label}
                </span>
              </Fragment>
            ))}
          </nav>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setPaletteOuverte(true)}
            title={t("recherche.titre")}
            className="search-trigger hidden h-9 items-center gap-2 rounded-lg border border-input bg-muted/40 px-2.5 text-[13px] text-muted-foreground shadow-sm outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:flex sm:w-44 lg:w-64"
          >
            <Search className="h-4 w-4 shrink-0" aria-hidden />
            <span className="flex-1 truncate text-left">{t("recherche.bouton")}</span>
            <Kbd>Ctrl K</Kbd>
          </button>
          <Button
            variant="ghost" size="icon" className="h-8 w-8 shrink-0 sm:hidden"
            title={t("recherche.titre")} aria-label={t("recherche.titre")}
            onClick={() => setPaletteOuverte(true)}
          >
            <Search className="h-4 w-4" />
          </Button>
          <SelecteurLangue />
          <span aria-hidden className="h-6 w-px bg-border/70" />
          <BoutonTheme />
          <span aria-hidden className="h-6 w-px bg-border/70" />
          <NotificationBell />
          <span aria-hidden className="hidden h-6 w-px bg-border/70 sm:block" />

          <DropdownMenu>
            <DropdownMenuTrigger className="hidden items-center gap-2 rounded-full py-1 pr-1.5 pl-1 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring sm:flex [&_svg.chevron]:size-4 [&_svg.chevron]:shrink-0 [&_svg.chevron]:text-muted-foreground">
              <span className="relative shrink-0">
                <AvatarUtilisateur photo={user?.photo ?? null} nom={user?.nom_complet} taille="sm" className="ring-2 ring-primary/20" />
                <span aria-hidden className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-background" />
              </span>
              <span className="hidden max-w-32 truncate text-sm font-medium lg:block xl:max-w-40">{user?.nom_complet}</span>
              <ChevronDown className="chevron" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="font-normal">
                  <p className="text-sm font-medium">{user?.nom_complet}</p>
                  <p className="text-xs text-muted-foreground">
                    {user?.identifiant} · {user?.matricule}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {user?.roles.map((r) => (
                      <Badge key={r} variant="secondary">{r}</Badge>
                    ))}
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/profil")}>
                <UserRound className="mr-2 h-4 w-4" />
                {t("shell.mon_profil")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => logout()}>
                <LogOut className="mr-2 h-4 w-4" />
                {t("shell.deconnexion")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="w-full flex-1 px-3 py-4 sm:px-4 md:px-6 md:py-6">
          <div className="app-container">{children}</div>
        </main>
      </div>

      <PaletteCommande ouvert={paletteOuverte} onOpenChange={setPaletteOuverte} />
    </div>
  );
}
