"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  onSubmit: (e?: React.BaseSyntheticEvent) => void;   // = form.handleSubmit(...)
  submitting: boolean;
  error?: string | null;                               // message général du serveur
  submitLabel?: string;
  wide?: boolean;
  children: React.ReactNode;
}

export function FormDialog({
  open, onOpenChange, title, description, onSubmit, submitting, error,
  submitLabel = "Enregistrer", wide, children,
}: Props) {
  const cadre = useRef<HTMLDivElement>(null);

  // Confort de saisie : à l'ouverture, le focus va sur le premier champ
  // (sauf si un champ porte déjà autoFocus, géré par le navigateur).
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      const racine = cadre.current;
      if (!racine || racine.querySelector("[autofocus]")) return;
      const cible = racine.querySelector<HTMLElement>(
        "input:not(:disabled), textarea:not(:disabled), button:not(:disabled), [tabindex]:not([tabindex='-1'])",
      );
      cible?.focus({ preventScroll: true });
    }, 60);
    return () => clearTimeout(t);
  }, [open ]);

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent
        className={`${wide ? "sm:max-w-2xl" : "sm:max-w-md"} max-h-[90vh] overflow-y-auto`}
      >
        <div ref={cadre}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {children}

          {error && (
            <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}