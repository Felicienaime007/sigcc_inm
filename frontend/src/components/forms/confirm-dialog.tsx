"use client";

import { Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalShell, type ModalSize } from "@/components/forms/modal-shell";
import { useT } from "@/lib/i18n/contexte";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  /** Taille (défaut : sm). */
  size?: ModalSize;
}

export function ConfirmDialog({
  open, onOpenChange, title, description, confirmLabel,
  destructive, loading, onConfirm, size = "sm",
}: Props) {
  const { t } = useT();
  const libelle = confirmLabel ?? t("commun.confirmer");
  return (
    <ModalShell
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size={size}
      busy={loading}
      icon={
        destructive ? (
          <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive [&_svg]:h-4 [&_svg]:w-4">
            <TriangleAlert aria-hidden />
          </span>
        ) : undefined
      }
      footer={
        <>
          <Button type="button" variant="outline" disabled={loading} onClick={() => onOpenChange(false)}>
            {t("commun.annuler")}
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            disabled={loading}
            onClick={() => void onConfirm()}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            {libelle}
          </Button>
        </>
      }
    >
      {/* Le contenu tient dans la description ; l'enveloppe assure erreur et focus. */}
      <></>
    </ModalShell>
  );
}
