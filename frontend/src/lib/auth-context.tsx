"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { api, setSessionExpiredHandler } from "./api";
import { tokenStore } from "./token-store";
import type { LoginResponse, Profil } from "@/types/auth";

interface AuthContextValue {
  user: Profil | null;
  loading: boolean;
  login: (identifiant: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Un privilège (string) ou une liste (tableau = AU MOINS UN des privilèges). ADMIN a tout. */
  can: (requis?: string | string[]) => boolean;
  hasRole: (role: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<Profil | null>(null);
  // Pas de token stocké : rien à restaurer, on évite un rendu « chargement » inutile
  const [loading, setLoading] = useState(
    () => Boolean(tokenStore.getAccess()) || Boolean(tokenStore.getRefresh()),
  );

  // Restauration de la session au chargement de la page
  useEffect(() => {
    if (!tokenStore.getAccess() && !tokenStore.getRefresh()) return;
    let ignore = false; // garde anti-démontage : pas de setState après unmount
    api
      .get<Profil>("/auth/me/") // si l'access est périmé, l'intercepteur renouvelle puis rejoue
      .then((res) => {
        if (!ignore) setUser(res.data);
      })
      .catch(() => tokenStore.clear())
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  // Session expirée en cours d'utilisation : retour à la connexion
  useEffect(() => {
    setSessionExpiredHandler(() => {
      queryClient.clear();
      setUser(null);
      router.replace("/login");
    });
    return () => setSessionExpiredHandler(null);
  }, [queryClient, router]);

  const login = useCallback(async (identifiant: string, password: string) => {
    const { data } = await api.post<LoginResponse>("/auth/login/", { identifiant, password });
    tokenStore.set(data.access, data.refresh);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    const refresh = tokenStore.getRefresh();
    try {
      if (refresh) await api.post("/auth/logout/", { refresh }); // blacklist côté serveur
    } catch {
      /* on déconnecte quand même localement */
    }
    tokenStore.clear();
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

  const value = useMemo(
    () => ({ user, loading, login, logout, can, hasRole }),
    [user, loading, login, logout, can, hasRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans <AuthProvider>");
  return ctx;
}