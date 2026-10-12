"use client";

import { useEffect, useRef } from "react";
import { CircleAlert } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type ModalSize = "sm" | "md" | "lg" | "xl";

/** sm 420 · md 560 · lg 720 · xl 960. */
const LARGEURS: Record<ModalSize, string> = {
  sm: "sm:max-w-[420px]",
  md: "sm:max-w-[560px]",
  lg: "sm:max-w-[720px]",
  xl: "sm:max-w-[960px]",
};

interface ModalShellProps {
  open: boolean;
  onOpenChange: (ouvert: boolean) => void;
  title: string;
  description?: string;
  /** Taille (défaut : md). */
  size?: ModalSize;
  /** Envoi en cours : Échap, clic sur le fond et ✕ désactivés. */
  busy?: boolean;
  /** Erreur du serveur, affichée en haut du contenu. */
  error?: string | null;
  /** Médaillon d'icône (ex. alerte destructive). */
  icon?: React.ReactNode;
  /** Pied fixe : Annuler puis action principale. */
  footer?: React.ReactNode;
  /** Focus auto sur le premier champ à l'ouverture (défaut : oui). */
  autoFocus?: boolean;
  children: React.ReactNode;
}

/**
 * Enveloppe mutualisée des modales SIGCC : en-tête fixe, contenu défilant,
 * pied fixe. Focus piégé et retour au déclencheur (Base UI), focus auto sur
 * le premier champ, fermeture bloquée pendant l'envoi. Sous 768 px :
 * panneau plein écran glissant par le bas.
 */
export function ModalShell({
  open, onOpenChange, title, description, size = "md", busy, error,
  icon, footer, autoFocus = true, children,
}: ModalShellProps) {
  const cadre = useRef<HTMLDivElement>(null);

  // Focus automatique sur le premier champ (sauf [autofocus] explicite).
  useEffect(() => {
    if (!open || !autoFocus) return;
    const t = window.setTimeout(() => {
      const racine = cadre.current;
      if (!racine || racine.querySelector("[autofocus]")) return;
      const cible = racine.querySelector<HTMLElement>(
        "input:not(:disabled), textarea:not(:disabled), select:not(:disabled), button:not(:disabled), [tabindex]:not([tabindex='-1'])",
      );
      cible?.focus({ preventScroll: true });
    }, 60);
    return () => window.clearTimeout(t);
  }, [open, autoFocus]);

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent
        showCloseButton={!busy}
        className={cn(
          "flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-[14px] p-0",
          LARGEURS[size],
          // Sous 768 px : panneau plein écran par le bas.
          "max-sm:top-auto max-sm:right-0 max-sm:bottom-0 max-sm:left-0 max-sm:max-h-[94vh] max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-t-[14px] max-sm:rounded-b-none",
        )}
      >
        <div ref={cadre} className="flex min-h-0 flex-col">
          <div className="flex shrink-0 items-start gap-3 border-b bg-popover px-5 pt-4 pr-12 pb-3.5">
            {icon}
            <div className="min-w-0 flex-1 pt-0.5">
              <DialogTitle className="text-[16px]">{title}</DialogTitle>
              {description && <DialogDescription className="mt-0.5">{description}</DialogDescription>}
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {error && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-[10px] border border-destructive/25 bg-destructive/10 p-3 text-sm font-medium text-destructive"
              >
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{error}</span>
              </p>
            )}
            {children}
          </div>

          {footer && (
            <div className="flex shrink-0 flex-col-reverse gap-2 border-t bg-muted/50 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-end">
              {footer}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
