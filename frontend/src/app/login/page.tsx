"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  ArrowRight,
  ArrowUp,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  Lock,
  Moon,
  Printer,
  Receipt,
  ShieldCheck,
  Sun,
  User,
  type LucideIcon,
} from "lucide-react";
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from "next/font/google";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelecteurLangue } from "@/components/i18n/selecteur-langue";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/i18n/contexte";
import { getErrorMessage } from "@/lib/errors";
import logo from "@/app/assets/image/logo-inm.png";

/* ───────── Polices ─────────
   Une pile de secours sans-serif est déclarée : même si Google Fonts est injoignable
   (développement hors ligne, réseau filtré), l'interface ne retombe jamais sur une police à empattements.
   Next.js exige des valeurs littérales dans next/font : les tableaux `fallback` sont donc écrits en dur. */
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "Segoe UI", "Helvetica Neue", "Arial", "sans-serif"],
});
const ui = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "Segoe UI", "Helvetica Neue", "Arial", "sans-serif"],
});

/* ───────── Validation (messages traduits) ───────── */
type FormValues = { identifiant: string; password: string };
const schemaTraduction = (t: (c: string) => string) =>
  z.object({
    identifiant: z.string().min(1, t("login.err_identifiant")),
    password: z.string().min(1, t("login.err_mdp")),
  });

const CLE_IDENTIFIANT = "sigcc.identifiant";

/* ───────── Styles et animations intégrés (rien à ajouter dans globals.css) ───────── */
const STYLES = `
.sg-ui {
  font-family: var(--font-ui, system-ui), ui-sans-serif, system-ui, "Segoe UI", "Helvetica Neue", Arial, sans-serif;
}
.sg-display {
  font-family: var(--font-display, system-ui), ui-sans-serif, system-ui, "Segoe UI", "Helvetica Neue", Arial, sans-serif;
}

/* Trame en CSS pur : nappes de points bleu nuit / blanc, assorties au bleu sombre du menu */
.trame-group { will-change: transform; animation: trame-float 26s ease-in-out infinite alternate; }
@keyframes trame-float { to { transform: translate3d(0, -16px, 0); } }
.trame {
  position: absolute;
  width: 70%; height: 70%;
  background-size: 12px 12px;
  -webkit-mask-image: radial-gradient(closest-side, #000 35%, transparent 100%);
  mask-image: radial-gradient(closest-side, #000 35%, transparent 100%);
}
.trame-c { left: 0;   top: 5%;  opacity: .35; background-image: radial-gradient(circle, #8EA2FF 1.7px, transparent 2.3px); }
.trame-m { left: 30%; top: 15%; opacity: .30; background-image: radial-gradient(circle, #FFFFFF 1.7px, transparent 2.3px); background-position: 4px 3px; }
.trame-y { left: 12%; top: 32%; opacity: .22; background-image: radial-gradient(circle, #4FC9CE 1.7px, transparent 2.3px); background-position: 8px 6px; }

/* Entrée unique du parcours */
@keyframes slip-in {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: none; }
}
.slip { opacity: 0; animation: slip-in .6s cubic-bezier(.2,.7,.2,1) forwards; animation-delay: var(--d, 0s); }

@keyframes line-grow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
.pipeline-line { transform-origin: top; animation: line-grow 1s ease-out .2s both; }

@keyframes pulse-ring {
  0%   { box-shadow: 0 0 0 0 rgba(255,255,255,.45); }
  70%  { box-shadow: 0 0 0 10px rgba(255,255,255,0); }
  100% { box-shadow: 0 0 0 0 rgba(255,255,255,0); }
}
.pulse-ring { animation: pulse-ring 2.4s ease-out 1.2s 3; }

@keyframes err-in {
  0%   { opacity: 0; transform: translateY(-6px); }
  30%  { opacity: 1; transform: translateX(0); }
  45%  { transform: translateX(-5px); }
  60%  { transform: translateX(4px); }
  75%  { transform: translateX(-2px); }
  100% { transform: none; }
}
.err-in { animation: err-in .45s ease-out; }

@media (prefers-reduced-motion: reduce) {
  .trame-group, .slip, .pipeline-line, .pulse-ring, .err-in { animation: none; opacity: 1; transform: none; }
}
`;

const inputClass =
  "h-12 rounded-xl border-slate-300 bg-white pl-11 text-base text-slate-900 shadow-xs transition-colors " +
  "placeholder:text-slate-400 hover:border-slate-400 " +
  "dark:border-input dark:bg-input/30 dark:text-foreground dark:placeholder:text-muted-foreground " +
  "focus-visible:border-[#1d2c5e] focus-visible:ring-0 focus-visible:ring-offset-0 " +
  "aria-[invalid=true]:border-red-400";

/* ───────── Trame bleu nuit ───────── */
function TrameCMJN({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`trame-group pointer-events-none absolute ${className}`}>
      <span className="trame trame-c" />
      <span className="trame trame-m" />
      <span className="trame trame-y" />
    </div>
  );
}

/* ───────── Repères de coupe ───────── */
function RepèresDeCoupe() {
  const base = "absolute h-5 w-5 border-white/30";
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-6">
      <span className={`${base} left-0 top-0 border-l border-t`} />
      <span className={`${base} right-0 top-0 border-r border-t`} />
      <span className={`${base} bottom-0 left-0 border-b border-l`} />
      <span className={`${base} bottom-0 right-0 border-b border-r`} />
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  const { t } = useT();
  return (
    <div className="flex items-center gap-3.5">
      {/* Le logo est large : on lui donne une pastille rectangulaire plutôt qu'un carré */}
      <div className={`flex items-center justify-center rounded-xl bg-white ${compact ? "h-11 px-2.5" : "h-14 px-3.5"}`}>
        <Image
          src={logo}
          alt={t("login.logo_alt")}
          sizes="120px"
          priority
          className={`w-auto max-w-[120px] object-contain ${compact ? "h-7" : "h-9"}`}
        />
      </div>
      <div className="leading-tight text-white">
        <p className={`sg-display font-extrabold tracking-tight ${compact ? "text-xl" : "text-2xl"}`}>SIGCC</p>
        <p className="text-sm text-white/75">{t("login.marque")}</p>
      </div>
    </div>
  );
}

/* ───────── Parcours d'un travail d'impression ───────── */
type Etape = {
  titre: string;
  detail: string;
  statut: string;
  etat: "fait" | "en-cours" | "a-venir";
  Icon: LucideIcon;
};

const ETAPES: (Omit<Etape, "titre" | "detail" | "statut"> & { cle: "devis" | "commande" | "facture" })[] = [
  { cle: "devis", etat: "fait", Icon: FileText },
  { cle: "commande", etat: "en-cours", Icon: Printer },
  { cle: "facture", etat: "a-venir", Icon: Receipt },
];

const marqueur: Record<Etape["etat"], string> = {
  fait: "bg-white text-[#1d2c5e]",
  "en-cours": "bg-[#8EA2FF] text-[#121c46] pulse-ring",
  "a-venir": "bg-white/10 text-white/70 ring-1 ring-inset ring-white/25",
};

const pastille: Record<Etape["etat"], string> = {
  fait: "bg-white/15 text-white",
  "en-cours": "bg-[#8EA2FF] text-[#121c46]",
  "a-venir": "bg-white/10 text-white/75",
};

function Parcours() {
  const { t } = useT();
  const textes = {
    devis: { titre: t("login.etape_devis"), detail: t("login.etape_devis_detail"), statut: t("login.etape_devis_statut") },
    commande: { titre: t("login.etape_commande"), detail: t("login.etape_commande_detail"), statut: t("login.etape_commande_statut") },
    facture: { titre: t("login.etape_facture"), detail: t("login.etape_facture_detail"), statut: t("login.etape_facture_statut") },
  };
  return (
    <ol className="relative space-y-3" aria-label={t("login.parcours_label")}>
      <span
        aria-hidden="true"
        className="pipeline-line absolute bottom-6 left-[19px] top-6 w-px bg-gradient-to-b from-white via-white/40 to-white/10"
      />
      {ETAPES.map(({ cle, etat, Icon }, i) => {
        const { titre, detail, statut } = textes[cle];
        return (
        <li
          key={cle}
          className="slip relative flex items-center gap-4"
          style={{ ["--d" as string]: `${0.25 + i * 0.22}s` }}
        >
          <span className={`z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${marqueur[etat]}`}>
            <Icon className="h-[18px] w-[18px]" />
          </span>
          <div className="flex flex-1 items-center justify-between gap-3 rounded-xl border border-white/15 bg-white/10 px-4 py-3 ring-1 ring-white/10">
            <div>
              <p className="text-sm font-semibold text-white">{titre}</p>
              <p className="text-xs text-white/70">{detail}</p>
            </div>
            <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${pastille[etat]}`}>
              {statut}
            </span>
          </div>
        </li>
        );
      })}
    </ol>
  );
}

/* ───────── Bascule clair / sombre (page hors coquille applicative) ───────── */
function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useT();
  const sombre = resolvedTheme === "dark";
  return (
    <Button
      variant="ghost" size="icon"
      className="h-8 w-8 shrink-0"
      title={sombre ? t("shell.theme_clair") : t("shell.theme_sombre")}
      aria-label={sombre ? t("shell.theme_clair") : t("shell.theme_sombre")}
      onClick={() => setTheme(sombre ? "light" : "dark")}
    >
      {sombre ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

/* ───────── Page ───────── */
export default function LoginPage() {
  const { t } = useT();
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const [erreur, setErreur] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [remember, setRemember] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schemaTraduction(t)) });

  // Déjà connecté dans cet onglet : retour au tableau de bord.
  // Volontairement sans paramètre de retour : le dernier espace consulté
  // n'est jamais restauré après un nouveau lancement.
  useEffect(() => {
    document.title = `${t("login.titre")} – SIGCC · ${t("login.marque")}`;
    if (!loading && user) router.replace("/");
  }, [loading, user, router, t]);

  // PAS de router.prefetch("/") ici : sans marqueur de session, le middleware
  // répond 307 vers /login et Next mettrait cette redirection en cache de
  // préchargement. Après connexion, router.replace("/") rejouerait la
  // redirection périmée en boucle côté client (spinner infini, zéro réseau),
  // alors qu'un rechargement complet (cookie présent) entre aussitôt.

  const enAttente = loading || !!user;

  // Identifiant mémorisé (jamais le mot de passe) : on place alors le curseur sur le mot de passe.
  useEffect(() => {
    if (enAttente) return;
    try {
      const saved = localStorage.getItem(CLE_IDENTIFIANT);
      if (saved) {
        setValue("identifiant", saved);
        setRemember(true);
        setFocus("password");
      }
    } catch {
      /* stockage indisponible : on ignore */
    }
  }, [enAttente, setValue, setFocus]);

  async function onSubmit(values: FormValues) {
    setErreur(null);
    try {
      const identifiant = values.identifiant.trim();
      await login(identifiant, values.password);
      try {
        if (remember) localStorage.setItem(CLE_IDENTIFIANT, identifiant);
        else localStorage.removeItem(CLE_IDENTIFIANT);
      } catch {
        /* ignore */
      }
      // Après authentification : toujours "/" (aucune restauration du dernier espace).
      router.replace("/");
    } catch (e) {
      setErreur(getErrorMessage(e, t("login.err_connexion")));
    }
  }

  return (
    <div className={`${ui.variable} ${display.variable} sg-ui grid min-h-screen lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]`}>
      <style>{STYLES}</style>

      {/* ───────── Panneau visuel (desktop) ───────── */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-b from-[#1a2757] via-[#1d2c5e] to-[#121c46] lg:flex lg:flex-col lg:justify-between lg:p-14">
        <TrameCMJN className="top-[6%] h-[640px] w-[640px] lg:-right-52 xl:-right-28" />
        <RepèresDeCoupe />

        <div className="relative z-10">
          <Brand />
        </div>

        <div className="relative z-10 max-w-xl">
          <h1 className="sg-display text-4xl font-extrabold leading-[1.1] tracking-tight text-white [text-wrap:balance] xl:text-[3.5rem]">
            {t("login.hero_titre")}
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-white/80">
            {t("login.hero_texte")}
          </p>
        </div>

        <div className="relative z-10 max-w-lg pb-2">
          <Parcours />
        </div>
      </aside>

      {/* ───────── Bandeau mobile ───────── */}
      <header className="relative overflow-hidden bg-gradient-to-b from-[#1a2757] via-[#1d2c5e] to-[#121c46] px-6 pb-12 pt-8 lg:hidden">
        <TrameCMJN className="-right-24 -top-24 h-[320px] w-[320px]" />
        <div className="relative z-10">
          <Brand compact />
        </div>
      </header>

      {/* ───────── Formulaire ───────── */}
      {enAttente ? (
        <main className="flex items-center justify-center bg-white p-6 lg:bg-slate-50 dark:bg-background dark:lg:bg-muted/20">
          <Loader2 className="h-7 w-7 animate-spin text-[#1d2c5e]" aria-label="Chargement" />
        </main>
      ) : (
        <main className="relative z-10 -mt-6 flex items-start justify-center overflow-hidden rounded-t-[28px] bg-white px-6 pb-10 pt-9 sm:px-10 lg:mt-0 lg:items-center lg:rounded-none lg:bg-slate-50 lg:py-12 dark:bg-background dark:lg:bg-muted/20">
          {/* Halo discret : rappel du bleu nuit, adaptatif au thème */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(36rem_14rem_at_50%_0rem,color-mix(in_oklab,var(--primary)_9%,transparent),transparent_70%)]"
          />
          <div className="relative w-full max-w-[26rem] lg:rounded-[20px] lg:border lg:border-slate-200/90 lg:bg-white lg:p-10 lg:shadow-[0_1px_2px_rgba(15,23,42,0.05),0_24px_48px_-24px_rgba(29,44,94,0.28)] dark:lg:border-border dark:lg:bg-card dark:lg:shadow-none">
            <div className="mb-7 flex items-start justify-between gap-3">
              <div>
                <p className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-[#1d2c5e]/15 bg-[#1d2c5e]/[0.06] px-2.5 py-1 text-[11px] font-semibold tracking-wide text-[#1d2c5e] uppercase dark:border-primary/25 dark:bg-primary/10 dark:text-primary">
                  <Lock className="h-3 w-3" aria-hidden />
                  {t("login.espace_securise")}
                </p>
                <h2 className="sg-display text-[28px] font-bold tracking-tight text-slate-900 dark:text-foreground">{t("login.titre")}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-muted-foreground">
                  {t("login.sous_titre")}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5 pt-1">
                <SelecteurLangue />
                <ThemeToggle />
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              {/* Identifiant */}
              <div className="space-y-1.5">
                <Label htmlFor="identifiant" className="text-sm font-semibold text-slate-800 dark:text-foreground">
                  {t("login.identifiant")}
                </Label>
                <div className="group relative">
                  <User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-[#1d2c5e]" />
                  <Input
                    id="identifiant"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    autoFocus
                    placeholder={t("login.ph_identifiant")}
                    enterKeyHint="next"
                    aria-invalid={!!errors.identifiant}
                    aria-describedby={errors.identifiant ? "identifiant-erreur" : undefined}
                    className={inputClass}
                    {...register("identifiant")}
                  />
                </div>
                {errors.identifiant && (
                  <p id="identifiant-erreur" className="text-sm text-red-600">
                    {errors.identifiant.message}
                  </p>
                )}
              </div>

              {/* Mot de passe */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-semibold text-slate-800 dark:text-foreground">
                  {t("login.mdp")}
                </Label>
                <div className="group relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-[#1d2c5e]" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder={t("login.ph_mdp")}
                    enterKeyHint="go"
                    aria-invalid={!!errors.password}
                    aria-describedby={errors.password ? "password-erreur" : undefined}
                    className={`${inputClass} pr-12`}
                    onKeyUp={(e) => setCapsLock(e.getModifierState("CapsLock"))}
                    {...register("password", { onBlur: () => setCapsLock(false) })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? t("login.masquer_mdp") : t("login.afficher_mdp")}
                    aria-pressed={showPassword}
                    className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d2c5e] dark:text-muted-foreground dark:hover:bg-muted dark:hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p id="password-erreur" className="text-sm text-red-600">
                    {errors.password.message}
                  </p>
                )}
                {capsLock && (
                  <p className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[13px] font-medium text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-400">
                    <ArrowUp className="h-3.5 w-3.5 shrink-0" />
                    {t("login.caps")}
                  </p>
                )}
              </div>

              {/* Se souvenir de l'identifiant */}
              <label className="flex cursor-pointer select-none items-center gap-2.5 text-sm text-slate-700 dark:text-muted-foreground">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-[#1d2c5e]"
                />
                {t("login.souvenir")}
              </label>

              {/* Erreur serveur */}
              {erreur && (
                <div
                  role="alert"
                  className="err-in flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3.5 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{erreur}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="group h-12 w-full rounded-xl bg-[#1d2c5e] text-base font-semibold text-white shadow-lg shadow-[#1d2c5e]/25 transition-all hover:bg-[#16224d] hover:shadow-xl hover:shadow-[#1d2c5e]/20 active:translate-y-px focus-visible:ring-4 focus-visible:ring-[#1d2c5e]/25 focus-visible:ring-offset-0 disabled:opacity-70 dark:shadow-none"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("login.en_cours")}
                  </>
                ) : (
                  <>
                    {t("login.connecter")}
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </Button>
            </form>

            <p className="mt-5 text-[13px] leading-relaxed text-slate-500 dark:text-muted-foreground">
              {t("login.oublie")}
            </p>

            <div className="mt-6 flex items-center gap-2 border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-border dark:text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#1d2c5e] dark:text-primary" />
              <p className="font-medium">{t("login.reserve")}</p>
              <span aria-hidden className="text-slate-300 dark:text-muted-foreground/50">·</span>
              <p className="truncate">{t("login.droits", { annee: new Date().getFullYear() })}</p>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}