"use client";

import { useId } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/kbd";
import { ModalShell, type ModalSize } from "@/components/forms/modal-shell";
import { useT } from "@/lib/i18n/contexte";

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
  /** Taille (wide = lg). Formulaire long (lg/xl) : Ctrl+Entrée pour valider. */
  size?: ModalSize;
  children: React.ReactNode;
}

export function FormDialog({
  open, onOpenChange, title, description, onSubmit, submitting, error,
  submitLabel = "Enregistrer", wide, size, children,
}: Props) {
  const { t } = useT();
  const taille: ModalSize = size ?? (wide ? "lg" : "md");
  const long = taille === "lg" || taille === "xl";
  const idFormulaire = useId();

  function onToucheFormulaire(e: React.KeyboardEvent<HTMLFormElement>) {
    // Formulaire long : Ctrl+Entrée (ou Cmd+Entrée) valide ; Entrée seule
    // reste locale aux champs (les textarea multilignes ne valident pas).
    if (long && e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      e.currentTarget.requestSubmit();
    }
  }

  return (
    <ModalShell
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size={taille}
      busy={submitting}
      error={error}
      footer={
        <>
          {long && (
            <span className="mr-auto hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex">
              <Kbd>Ctrl</Kbd>+<Kbd>Entrée</Kbd> {t("modales.valider")}
            </span>
          )}
          <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="submit" form={idFormulaire} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            {submitLabel}
          </Button>
        </>
      }
    >
      <form id={idFormulaire} onSubmit={onSubmit} onKeyDown={onToucheFormulaire} className="space-y-4" noValidate>
        {children}
      </form>
    </ModalShell>
  );
}
