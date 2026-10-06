const ACCESS = "sigcc_access";
const REFRESH = "sigcc_refresh";

const dispo = () => typeof window !== "undefined";

export const tokenStore = {
  getAccess: () => (dispo() ? localStorage.getItem(ACCESS) : null),
  getRefresh: () => (dispo() ? localStorage.getItem(REFRESH) : null),
  set(access: string, refresh?: string) {
    if (!dispo()) return;
    localStorage.setItem(ACCESS, access);
    if (refresh) localStorage.setItem(REFRESH, refresh);
  },
  clear() {
    if (!dispo()) return;
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
  },
};