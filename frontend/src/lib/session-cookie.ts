/**
 * Marqueur de session non sensible (cookie lisible par le middleware).
 *
 * Les JWT restent en `sessionStorage` (inaccessibles au middleware qui
 * s'exécute côté serveur). Ce cookie `sigcc_session=1` sert uniquement
 * d'indice de navigation : présent = une authentification a eu lieu dans
 * cet onglet, absent = accès direct sans authentification → /login.
 * La sécurité réelle reste garantie par l'API (JWT) + le guard client.
 */
const NOM = "sigcc_session";

export function poserMarqueurSession() {
  if (typeof document === "undefined") return;
  document.cookie = `${NOM}=1; path=/; max-age=86400; SameSite=Lax`;
}

export function retirerMarqueurSession() {
  if (typeof document === "undefined") return;
  document.cookie = `${NOM}=; path=/; max-age=0; SameSite=Lax`;
}
