"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { NAV } from "@/config/nav";
import { estPrete } from "@/config/routes";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { can, hasRole } = useAuth();
  const estAdmin = hasRole("ADMIN");

  /** Visible = privilège OK **ET** rôle OK. ADMIN voit tout (sous réserve du privilège, qu'il a toujours). */
  const estVisible = (item: { privilege?: string | string[]; roles?: string[] }) => {
    if (item.privilege && !can(item.privilege)) return false;
    if (!item.roles || item.roles.length === 0) return true;
    if (estAdmin) return true;
    return item.roles.some((r) => hasRole(r));
  };

  const toutesLesRoutes = NAV.flatMap((g) => g.items.map((i) => i.href));

  const actif = (href: string) => {
    if (href === "/") return pathname === "/";
    if (!(pathname === href || pathname.startsWith(`${href}/`))) return false;
    // Si une entrée plus spécifique correspond aussi, seule celle-là est active
    return !toutesLesRoutes.some(
      (autre) => autre !== href && autre.startsWith(`${href}/`) && (pathname === autre || pathname.startsWith(`${autre}/`)),
    );
  };

  return (
    <nav aria-label="Navigation principale" className="flex flex-col gap-6 px-3 py-4">
      {NAV.map((groupe) => {
        const items = groupe.items.filter(estVisible);
        if (items.length === 0) return null; // groupe entier masqué si rien d'accessible au rôle
        return (
          <section key={groupe.label} aria-label={groupe.label}>
            <div className="mb-2 flex items-center gap-2 px-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
                {groupe.label}
              </p>
              <span aria-hidden className="h-px flex-1 bg-border/70" />
              <span className="text-[10px] tabular-nums text-muted-foreground/60">{items.length}</span>
            </div>
            <ul className="flex flex-col gap-1">
              {items.map(({ href, label, icon: Icon }) => {
                const estActif = actif(href);
                const prete = estPrete(href);
                if (!prete) {
                  return (
                    <li key={`${groupe.label}-${href}`}>
                      <span
                        title="Page en cours de réalisation"
                        aria-disabled="true"
                        className="group flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground/50"
                      >
                        <Icon className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
                        <span className="truncate">{label}</span>
                        <span className="ml-auto shrink-0 rounded-full border border-dashed border-muted-foreground/30 px-1.5 py-0.5 text-[10px] font-medium">
                          Bientôt
                        </span>
                      </span>
                    </li>
                  );
                }
                return (
                  <li key={`${groupe.label}-${href}`}>
                    <Link
                      href={href}
                      onClick={onNavigate}
                      aria-current={estActif ? "page" : undefined}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm outline-none transition-all duration-150",
                        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                        estActif
                          ? "bg-primary font-medium text-primary-foreground shadow-sm"
                          : "text-foreground/70 hover:bg-muted hover:text-foreground active:bg-muted/80",
                      )}
                    >
                      {/* Indicateur latéral pour l'item actif (visible en mode clair/sombre) */}
                      <span
                        aria-hidden
                        className={cn(
                          "absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary-foreground transition-opacity",
                          estActif ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <Icon
                        className={cn("h-4 w-4 shrink-0 transition-colors", estActif ? "" : "text-muted-foreground group-hover:text-foreground")}
                        aria-hidden
                      />
                      <span className="truncate">{label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </nav>
  );
}
