"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/i18n/contexte";

/** Affiche les enfants seulement si l'utilisateur a le privilège (confort d'affichage). */
export function Can({
  privilege,
  children,
  fallback = null,
}: {
  privilege: string | string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { can } = useAuth();
  return <>{can(privilege) ? children : fallback}</>;
}

/** Garde de page : à placer en haut de chaque page protégée par un privilège. */
export function RequirePrivilege({
  privilege,
  children,
}: {
  privilege: string | string[];
  children: React.ReactNode;
}) {
  const { t } = useT();
  const { can } = useAuth();
  if (can(privilege)) return <>{children}</>;
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <ShieldAlert className="h-10 w-10 text-muted-foreground" aria-hidden />
      <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{t("commun.erreur_403")}</p>
      <h2 className="text-lg font-semibold">{t("commun.acces_refuse")}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        {t("commun.acces_refuse_desc")}
      </p>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        {t("commun.retour_accueil")}
      </Link>
    </div>
  );
}