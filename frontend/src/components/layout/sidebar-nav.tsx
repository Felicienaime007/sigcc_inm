"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/i18n/contexte";
import { NAV } from "@/config/nav";
import { estPrete } from "@/config/routes";

export function SidebarNav({ onNavigate, repliee = false }: { onNavigate?: () => void; repliee?: boolean }) {
  const pathname = usePathname();
  const { t } = useT();
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
    <nav aria-label="Navigation principale" className={cn("flex flex-col gap-5 py-4", repliee ? "items-center px-2" : "px-3")}>
      {NAV.map((groupe) => {
        const items = groupe.items.filter(estVisible);
        if (items.length === 0) return null; // groupe entier masqué si rien d'accessible au rôle
        if (repliee) {
          // Mode replié : pastilles d'icônes avec infobulle native, séparées par groupe.
          return (
            <section key={groupe.label} aria-label={t(groupe.label)} className="flex w-full flex-col items-center gap-1">
              <ul className="flex w-full flex-col items-center gap-1">
                {items.map(({ href, label, icon: Icon }, index) => {
                  const estActif = actif(href);
                  const prete = estPrete(href);
                  const cle = `${groupe.label}-${href}-${label}-${index}`;
                  const tuile = (
                    <span
                      aria-hidden
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
                        estActif
                          ? "bg-white text-[#16224d] shadow-lg shadow-[#0a1230]/40"
                          : "bg-white/10 text-white/85 hover:bg-white/20 hover:text-white",
                      )}
                    >
                      <Icon className="h-[18px] w-[18px]" aria-hidden />
                    </span>
                  );
                  if (!prete) {
                    return (
                      <li key={cle} title={`${t(label)} — ${t("nav.bientot")}`}>
                        <span aria-disabled="true" className="relative flex cursor-not-allowed opacity-50">
                          {tuile}
                          <span aria-hidden className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-amber-300" />
                        </span>
                      </li>
                    );
                  }
                  return (
                    <li key={cle} title={t(label)}>
                      <Link
                        href={href}
                        onClick={onNavigate}
                        aria-current={estActif ? "page" : undefined}
                        aria-label={t(label)}
                        className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                      >
                        {tuile}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <span aria-hidden className="my-1 h-px w-8 bg-white/15" />
            </section>
          );
        }
        return (
          <section key={groupe.label} aria-label={t(groupe.label)}>
            <div className="mb-1.5 flex items-center gap-2 px-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/55">
                {t(groupe.label)}
              </p>
              <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-white/25 to-transparent" />
              <span className="rounded-full bg-white/10 px-1.5 py-px text-[10px] tabular-nums text-white/80">{items.length}</span>
            </div>
            <ul className="flex flex-col gap-0.5">
              {items.map(({ href, label, icon: Icon }, index) => {
                const estActif = actif(href);
                const prete = estPrete(href);
                const cle = `${groupe.label}-${href}-${label}-${index}`;
                if (!prete) {
                  return (
                    <li key={cle}>
                      <span
                        title={t("nav.bientot_titre")}
                        aria-disabled="true"
                        className="group flex cursor-not-allowed items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm text-white/40"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/5">
                          <Icon className="h-4 w-4 opacity-60" aria-hidden />
                        </span>
                        <span className="truncate">{t(label)}</span>
                        <span className="ml-auto shrink-0 rounded-full border border-dashed border-white/25 px-1.5 py-0.5 text-[10px] font-medium text-white/60">
                          {t("nav.bientot")}
                        </span>
                      </span>
                    </li>
                  );
                }
                return (
                  <li key={cle}>
                    <Link
                      href={href}
                      onClick={onNavigate}
                      aria-current={estActif ? "page" : undefined}
                      className={cn(
                        "group relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm outline-none transition-all duration-150",
                        "focus-visible:ring-2 focus-visible:ring-white/60",
                        estActif
                          ? "bg-white font-medium text-[#16224d] shadow-lg shadow-[#0a1230]/40"
                          : "text-white/70 hover:translate-x-0.5 hover:bg-white/10 hover:text-white active:translate-x-0",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
                          estActif
                            ? "bg-[#1d2c5e]/10 text-[#1d2c5e]"
                            : "bg-white/10 text-white/85 group-hover:bg-white/20 group-hover:text-white",
                        )}
                      >
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="truncate">{t(label)}</span>
                      {estActif && (
                        <span aria-hidden className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-[#1d2c5e]" />
                      )}
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
