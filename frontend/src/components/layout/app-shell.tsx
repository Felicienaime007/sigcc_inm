"use client";
import { usePathname, useRouter } from "next/navigation";
import { Factory, UserRound } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { ChevronRight, LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
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

function Marque() {
  return (
    <div className="flex h-16 shrink-0 items-center gap-3 border-b bg-background px-4">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <Factory className="h-5 w-5" aria-hidden />
      </span>
      <span className="leading-tight">
        <span className="block text-[15px] font-bold tracking-tight">SIGCC</span>
        <span className="block text-[11px] font-medium text-muted-foreground">Imprimerie Nationale</span>
      </span>
      <Badge variant="outline" className="ml-auto text-[10px] font-semibold">
        v1.0
      </Badge>
    </div>
  );
}

function useFilAriane(pathname: string): { label: string }[] {
  return useMemo(() => {
    if (pathname === "/") return [{ label: "Tableau de bord" }];
    const chemin: string = pathname;
    const tous = NAV.flatMap((g) => g.items.map((i) => ({ ...i, groupe: g.label })));
    // entrée exacte d'abord, sinon préfixe le plus long
    const exacte = tous.find((i) => i.href === chemin);
    if (exacte) return [{ label: exacte.groupe }, { label: exacte.label }];
    const prefixe = tous.filter((i) => i.href !== "/" && chemin.startsWith(`${i.href}/`)).sort((a, b) => b.href.length - a.href.length)[0];
    if (prefixe) return [{ label: prefixe.groupe }, { label: prefixe.label }, { label: "Détail" }];
    // repli : segments lisibles
    return chemin
      .split("/")
      .filter(Boolean)
      .map((s: string) => ({ label: s.replace(/-/g, " ").replace(/^\w/, (c: string) => c.toUpperCase()) }));
  }, [pathname]);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOuvert, setMenuOuvert] = useState(false);
  const fil = useFilAriane(pathname);

  return (
    <div className="flex min-h-screen bg-muted/20">
      {/* Menu fixe sur grand écran */}
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r bg-background lg:flex">
        <Marque />
        <div className="flex-1 overflow-y-auto">
          <SidebarNav />
        </div>
        <div className="shrink-0 border-t p-3">
          <div className="flex items-center gap-3 rounded-lg bg-muted/60 px-3 py-2.5">
            <AvatarUtilisateur idUtilisateur={user?.id_utilisateur ?? null} nom={user?.nom_complet} taille="sm" />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[13px] font-medium">{user?.nom_complet ?? "—"}</span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {user?.roles?.[0] ?? user?.identifiant ?? ""}
                {user && user.roles.length > 1 ? ` +${user.roles.length - 1}` : ""}
              </span>
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="Se déconnecter" onClick={() => logout()}>
              <LogOut className="h-4 w-4" />
              <span className="sr-only">Se déconnecter</span>
            </Button>
          </div>
        </div>
      </aside>

      {/* Menu coulissant sur mobile */}
      <Sheet open={menuOuvert} onOpenChange={setMenuOuvert}>
        <SheetContent side="left" className="flex w-72 flex-col overflow-hidden p-0">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <Marque />
          <div className="flex-1 overflow-y-auto">
            <SidebarNav onNavigate={() => setMenuOuvert(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur-md">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMenuOuvert(true)}>
            <Menu className="h-5 w-5" />
            <span className="sr-only">Ouvrir le menu</span>
          </Button>

          {/* Fil d'Ariane */}
          <nav aria-label="Fil d'Ariane" className="hidden min-w-0 items-center gap-1 text-sm sm:flex">
            {fil.map((miette: { label: string }, i: number) => (
              <Fragment key={`${miette.label}-${i}`}>
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden />}
                <span
                  className={
                    i === fil.length - 1
                      ? "truncate font-semibold text-foreground"
                      : "shrink-0 text-muted-foreground"
                  }
                >
                  {miette.label}
                </span>
              </Fragment>
            ))}
          </nav>
          <div className="flex-1" />

          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
              <AvatarUtilisateur idUtilisateur={user?.id_utilisateur ?? null} nom={user?.nom_complet} taille="sm" />
              <span className="hidden max-w-40 truncate text-sm font-medium md:block">{user?.nom_complet}</span>
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
                Mon profil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => logout()}>
                <LogOut className="mr-2 h-4 w-4" />
                Se déconnecter
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
