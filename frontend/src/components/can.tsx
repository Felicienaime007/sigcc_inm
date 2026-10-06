"use client";

import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

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
  const { can } = useAuth();
  if (can(privilege)) return <>{children}</>;
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <ShieldAlert className="h-10 w-10 text-muted-foreground" />
      <h2 className="text-lg font-semibold">Accès refusé</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Vous n&apos;avez pas le privilège nécessaire pour consulter cette page.
      </p>
    </div>
  );
}