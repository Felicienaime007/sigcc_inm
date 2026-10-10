/**
 * Stockage de session STRICTE.
 *
 * Exigence : à chaque démarrage de l'application, l'utilisateur est
 * systématiquement dirigé vers la page d'authentification et le dernier
 * espace de travail n'est jamais restauré automatiquement.
 *
 * On utilise donc `sessionStorage` (vidé à la fermeture de l'onglet /
 * du navigateur) et jamais `localStorage` pour les JWT.
 * Les anciennes clés `localStorage` sont purgées pour forcer une
 * ré-authentification après mise à jour.
 */
const ACCESS = "sigcc_access";
const REFRESH = "sigcc_refresh";

const dispo = () => typeof window !== "undefined";

function purgeHeritage() {
  if (!dispo()) return;
  try {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
  } catch {
    /* stockage indisponible : rien à purger */
  }
}

export const tokenStore = {
  getAccess: () => {
    if (!dispo()) return null;
    purgeHeritage();
    try {
      return sessionStorage.getItem(ACCESS);
    } catch {
      return null;
    }
  },
  getRefresh: () => {
    if (!dispo()) return null;
    purgeHeritage();
    try {
      return sessionStorage.getItem(REFRESH);
    } catch {
      return null;
    }
  },
  set(access: string, refresh?: string) {
    if (!dispo()) return;
    purgeHeritage();
    try {
      sessionStorage.setItem(ACCESS, access);
      if (refresh) sessionStorage.setItem(REFRESH, refresh);
    } catch {
      /* quota / navigation privée : la session restera en mémoire */
    }
  },
  clear() {
    if (!dispo()) return;
    try {
      sessionStorage.removeItem(ACCESS);
      sessionStorage.removeItem(REFRESH);
    } catch {
      /* ignore */
    }
    purgeHeritage();
  },
};