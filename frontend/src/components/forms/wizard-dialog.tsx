"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/kbd";
import { ModalShell, type ModalSize } from "@/components/forms/modal-shell";
import { useT } from "@/lib/i18n/contexte";
import { cn } from "@/lib/utils";

export interface WizardStep {
  /** Libellé court affiché dans l'indicateur. */
  label: string;
  description?: string;
  /** Validation de l'étape : message d'erreur ou null si OK (synchrone ou non). */
  validate?: () => string | null | Promise<string | null>;
}

interface WizardDialogProps {
  open: boolean;
  onOpenChange: (ouvert: boolean) => void;
  title: string;
  description?: string;
  steps: WizardStep[];
  /** Contenu de l'étape courante. */
  children: (etape: number) => React.ReactNode;
  /** Étape initiale à chaque ouverture (défaut 0). */
  initialStep?: number;
  nextLabel?: string;
  backLabel?: string;
  submitLabel: string;
  submitting?: boolean;
  /** Erreur du serveur, affichée en haut. */
  error?: string | null;
  onStepChange?: (etape: number) => void;
  onSubmit: () => void | Promise<void>;
  size?: ModalSize;
}

/**
 * Assistant en étapes : indicateur numéroté (aria-current="step"),
 * validation par étape (le bouton Suivant est bloqué par le message
 * retourné), Retour / Suivant / Valider. Ctrl+Entrée avance ou valide.
 */
export function WizardDialog({
  open, onOpenChange, title, description, steps, children,
  initialStep = 0, nextLabel, backLabel, submitLabel, submitting,
  error, onStepChange, onSubmit, size = "lg",
}: WizardDialogProps) {
  const { t } = useT();
  const [etape, setEtape] = useState(initialStep);
  const [erreurEtape, setErreurEtape] = useState<string | null>(null);
  const [controle, setControle] = useState(false);
  const derniere = etape === steps.length - 1;

  useEffect(() => {
    if (open) {
      setEtape(initialStep);
      setErreurEtape(null);
      setControle(false);
    }
  }, [open, initialStep]);

  function aller(i: number) {
    setEtape(i);
    setErreurEtape(null);
    onStepChange?.(i);
  }

  async function suivant() {
    if (controle || submitting) return;
    const controleur = steps[etape]?.validate;
    if (controleur) {
      setControle(true);
      try {
        const message = await controleur();
        if (message) {
          setErreurEtape(message);
          return;
        }
      } finally {
        setControle(false);
      }
    }
    setErreurEtape(null);
    if (derniere) void onSubmit();
    else aller(etape + 1);
  }

  function onTouche(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      const cible = e.target as HTMLElement | null;
      // Laisse les textarea multilignes tranquilles : Ctrl+Entrée les valide aussi.
      if (cible && (cible.tagName === "TEXTAREA" || cible.tagName === "INPUT" || cible.tagName === "SELECT" || cible.isContentEditable)) {
        e.preventDefault();
        void suivant();
      }
    }
  }

  const occupe = submitting || controle;

  return (
    <ModalShell
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size={size}
      busy={submitting}
      error={error ?? erreurEtape}
      footer={
        <>
          <span className="mr-auto hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex">
            <Kbd>Ctrl</Kbd>+<Kbd>Entrée</Kbd> {derniere ? t("modales.valider") : t("modales.suivant")}
          </span>
          <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
            {t("commun.annuler")}
          </Button>
          {etape > 0 && (
            <Button type="button" variant="ghost" disabled={occupe} onClick={() => aller(etape - 1)}>
              {backLabel ?? t("modales.retour")}
            </Button>
          )}
          <Button type="button" disabled={occupe} onClick={suivant}>
            {occupe && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            {derniere ? submitLabel : (nextLabel ?? t("modales.suivant"))}
          </Button>
        </>
      }
    >
      <ol
        aria-label={t("modales.etapes", { etape: etape + 1, total: steps.length })}
        className="flex items-start gap-1"
      >
        {steps.map((s, i) => {
          const terminee = i < etape;
          const courante = i === etape;
          return (
            <li key={s.label} className="flex min-w-0 flex-1 items-start gap-2" aria-current={courante ? "step" : undefined}>
              <span
                aria-hidden
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums",
                  terminee && "bg-[#15803d] text-white",
                  courante && "bg-primary text-primary-foreground",
                  !terminee && !courante && "bg-muted text-muted-foreground",
                )}
              >
                {terminee ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className="min-w-0 pt-0.5 leading-tight">
                <span className={cn("block truncate text-[12px] font-semibold", courante ? "text-foreground" : "text-muted-foreground")}>
                  {s.label}
                </span>
                {s.description && (
                  <span className="hidden truncate text-[11px] text-muted-foreground sm:block">{s.description}</span>
                )}
              </span>
              {i < steps.length - 1 && (
                <span aria-hidden className={cn("mt-3 h-px min-w-3 flex-1", i < etape ? "bg-[#15803d]" : "bg-border")} />
              )}
            </li>
          );
        })}
      </ol>

      <div onKeyDown={onTouche}>
        {children(etape)}
      </div>
    </ModalShell>
  );
}
