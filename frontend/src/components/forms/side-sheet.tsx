"use client";

import { CircleAlert } from "lucide-react";
import {
  Sheet, SheetContent, SheetDescription, SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface SideSheetProps {
  open: boolean;
  onOpenChange: (ouvert: boolean) => void;
  title: string;
  description?: string;
  /** Envoi en cours : Échap, clic sur le fond et ✕ désactivés. */
  busy?: boolean;
  /** Erreur du serveur, affichée en haut du contenu. */
  error?: string | null;
  /** Pied fixe : Annuler puis action principale. */
  footer?: React.ReactNode;
  /** Largeur sur écran large (480 à 640 px, défaut 560). */
  width?: 480 | 560 | 640;
  children: React.ReactNode;
}

const LARGEURS: Record<NonNullable<SideSheetProps["width"]>, string> = {
  480: "sm:max-w-[480px]",
  560: "sm:max-w-[560px]",
  640: "sm:max-w-[640px]",
};

/**
 * Tiroir latéral droit (détails, formulaires longs) : en-tête fixe, contenu
 * défilant, pied fixe. Pleine largeur sur mobile. Focus piégé et retour au
 * déclencheur (Base UI).
 */
export function SideSheet({
  open, onOpenChange, title, description, busy, error, footer, width = 560, children,
}: SideSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <SheetContent
        side="right"
        showCloseButton={!busy}
        className={cn(
          "w-full gap-0 p-0 sm:w-auto sm:min-w-[480px]",
          LARGEURS[width],
          "max-sm:max-w-none",
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 border-b px-5 pt-4 pr-12 pb-3.5">
            <SheetTitle className="text-[16px] font-semibold tracking-tight">{title}</SheetTitle>
            {description && <SheetDescription className="mt-0.5">{description}</SheetDescription>}
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
      </SheetContent>
    </Sheet>
  );
}
