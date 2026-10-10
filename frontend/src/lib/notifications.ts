import type { QueryClient } from "@tanstack/react-query";
import { api } from "./api";

export const CLE_RESUME = "notifications/resume";
const KEY_SON = "sigcc_notif_son";
const KEY_BUREAU = "sigcc_notif_bureau";

// ------------------------------------------------------------- Réglages locaux
const ok = () => typeof window !== "undefined";

export const sonActif = () => ok() && localStorage.getItem(KEY_SON) === "1";
export const bureauActif = () => ok() && localStorage.getItem(KEY_BUREAU) === "1";

export function setSon(actif: boolean) {
  if (ok()) localStorage.setItem(KEY_SON, actif ? "1" : "0");
}

/** Active les notifications du navigateur (demande la permission). Retourne false si refusée. */
export async function setBureau(actif: boolean): Promise<boolean> {
  if (!ok()) return false;
  if (!actif) {
    localStorage.setItem(KEY_BUREAU, "0");
    return true;
  }
  if (typeof Notification === "undefined") return false;
  const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  const accorde = permission === "granted";
  localStorage.setItem(KEY_BUREAU, accorde ? "1" : "0");
  return accorde;
}

// --------------------------------------------------------------------- Alertes
export function bip() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
    setTimeout(() => void ctx.close(), 600);
  } catch {
    /* son bloqué par le navigateur : sans conséquence */
  }
}

/** Notification du navigateur, seulement si l'onglet est caché (sinon le toast suffit). */
export function notifierBureau(titre: string, corps: string, auClic: () => void) {
  if (!ok() || typeof Notification === "undefined" || Notification.permission !== "granted") return;
  if (!bureauActif() || !document.hidden) return;
  const n = new Notification(titre, { body: corps, tag: "sigcc" });
  n.onclick = () => {
    window.focus();
    auClic();
    n.close();
  };
}

// ------------------------------------------------------------------ Actions API
export function rafraichir(qc: QueryClient) {
  void qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("notifications") });
}

export async function marquerLue(qc: QueryClient, id: number) {
  await api.post(`/notifications/${id}/lire/`);
  rafraichir(qc);
}

export async function toutMarquerLu(qc: QueryClient) {
  await api.post("/notifications/lire-tout/");
  rafraichir(qc);
}

// ---------------------------------------------------------------------- Temps
const LOCALES_RELATIF: Record<string, string> = { fr: "fr", en: "en", mg: "mg" };

export function tempsRelatif(iso: string, langue = "fr"): string {
  const rtf = new Intl.RelativeTimeFormat(LOCALES_RELATIF[langue] ?? "fr", { numeric: "auto" });
  const s = (new Date(iso).getTime() - Date.now()) / 1000;
  const abs = Math.abs(s);
  if (abs < 60) return langue === "en" ? "just now" : langue === "mg" ? "teo izao" : "à l'instant";
  if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(s / 3600), "hour");
  return rtf.format(Math.round(s / 86_400), "day");
}