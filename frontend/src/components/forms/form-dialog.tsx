"use client";

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
  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent
        className={`${wide ? "sm:max-w-2xl" : "sm:max-w-md"} max-h-[90vh] overflow-y-auto`}
      >
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
      </DialogContent>
    </Dialog>
  );
}