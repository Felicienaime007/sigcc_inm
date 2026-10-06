import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { tokenStore } from "./token-store";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

export const api = axios.create({ baseURL: BASE_URL });

type Retriable = InternalAxiosRequestConfig & { _retry?: boolean };

// Appelé quand la session ne peut plus être renouvelée (refresh invalide ou expiré)
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(fn: (() => void) | null) {
  onSessionExpired = fn;
}

api.interceptors.request.use((config) => {
  const token = tokenStore.getAccess();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Un seul refresh à la fois, même si plusieurs requêtes reçoivent un 401 ensemble
let refreshing: Promise<string> | null = null;

async function refreshAccess(): Promise<string> {
  const refresh = tokenStore.getRefresh();
  if (!refresh) throw new Error("Aucun refresh token");
  // axios « nu » : on évite de repasser par nos intercepteurs
  const { data } = await axios.post(`${BASE_URL}/auth/refresh/`, { refresh });
  tokenStore.set(data.access, data.refresh); // le backend fait tourner les refresh
  return data.access as string;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as Retriable | undefined;
    const url = original?.url ?? "";
    const appelAuth = url.includes("/auth/login/") || url.includes("/auth/refresh/");

    if (error.response?.status === 401 && original && !original._retry && !appelAuth) {
      original._retry = true;
      try {
        // Un seul refresh à la fois : la promesse n'est créée que si aucune n'est en cours
        // (écrire `refreshing ??= refreshAccess()` appellerait refreshAccess à chaque 401,
        // car l'argument est évalué avant l'assignation conditionnelle).
        if (!refreshing) {
          refreshing = refreshAccess().finally(() => {
            refreshing = null;
          });
        }
        const access = await refreshing;
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${access}`;
        return api(original);
      } catch {
        tokenStore.clear();
        onSessionExpired?.();
      }
    }
    return Promise.reject(error);
  },
);