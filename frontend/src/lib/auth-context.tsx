"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { api, setSessionExpiredHandler } from "./api";
import { tokenStore } from "./token-store";
import { poserMarqueurSession, retirerMarqueurSession } from "./session-cookie";
import type { LoginResponse, Profil } from "@/types/auth";

interface AuthContextValue {
  user: Profil | null;
  loading: boolean;
  login: (identifiant: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Recharge le profil depuis /auth/me/ (ex. après changement de photo). */
  refresh: () => Promise<void>;
  /** Un privilège (string) ou une liste (tableau = AU MOINS UN des privilèges). ADMIN a tout. */
  can: (requis?: string | string[]) => boolean;
  hasRole: (role: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<Profil | null>(null);
  // Toujours false au premier rendu (identique au SSR : pas d'erreur
  // d'hydratation) ; la restauration passe à true dans l'effet ci-dessous.
  const [loading, setLoading] = useState(false);

  // Restauration de la session dans l'onglet courant uniquement
  // (sessionStorage : aucun token après un nouveau lancement → /login).
  useEffect(() => {
    // Sans token dans l'onglet courant : rien à restaurer (`loading` vaut déjà false).
    if (!tokenStore.getAccess() && !tokenStore.getRefresh()) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    let ignore = false; // garde anti-démontage : pas de setState après unmount
    api
      .get<Profil>("/auth/me/") // si l'access est périmé, l'intercepteur renouvelle puis rejoue
      .then((res) => {
        if (ignore) return;
        setUser(res.data);
        poserMarqueurSession();
      })
      .catch(() => {
        tokenStore.clear();
        retirerMarqueurSession();
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  // Session expirée en cours d'utilisation : session invalidée + retour à la connexion
  useEffect(() => {
    setSessionExpiredHandler(() => {
      tokenStore.clear();
      retirerMarqueurSession();
      queryClient.clear();
      setUser(null);
      router.replace("/login");
    });
    return () => setSessionExpiredHandler(null);
  }, [queryClient, router]);

  const login = useCallback(async (identifiant: string, password: string) => {
    const { data } = await api.post<LoginResponse>("/auth/login/", { identifiant, password });
    tokenStore.set(data.access, data.refresh);
    poserMarqueurSession();
    setUser(data.user);
    // Volontairement : aucune restauration du dernier espace consulté,
    // la navigation post-connexion se fait toujours vers "/" (voir login/page).
  }, []);

  const logout = useCallback(async () => {
    const refresh = tokenStore.getRefresh();
    try {
      if (refresh) await api.post("/auth/logout/", { refresh }); // blacklist côté serveur
    } catch {
      /* on déconnecte quand même localement */
    }
    // La déconnexion invalide la session localement puis redirige vers /login
    tokenStore.clear();
    retirerMarqueurSession();
    queryClient.clear();
    setUser(null);
    router.replace("/login");
  }, [queryClient, router]);

  const can = useCallback(
    (requis?: string | string[]) => {
      if (!user) return false;
      if (!requis || (Array.isArray(requis) && requis.length === 0)) return true;
      if (user.roles.includes("ADMIN")) return true;
      const liste = Array.isArray(requis) ? requis : [requis];
      return liste.some((p) => user.privileges.includes(p));
    },
    [user],
  );

  const hasRole = useCallback((role: string) => !!user?.roles.includes(role), [user]);

  const refresh = useCallback(async () => {
    if (!tokenStore.getAccess() && !tokenStore.getRefresh()) return;
    const res = await api.get<Profil>("/auth/me/");
    setUser(res.data);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, can, hasRole, refresh }),
    [user, loading, login, logout, can, hasRole, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans <AuthProvider>");
  return ctx;
}