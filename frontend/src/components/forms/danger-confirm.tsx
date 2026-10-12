"use client";

import { useEffect, useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/forms/field";
import { ModalShell } from "@/components/forms/modal-shell";
import { useT } from "@/lib/i18n/contexte";

interface DangerConfirmProps {
  open: boolean;
  onOpenChange: (ouvert: boolean) => void;
  title: string;
  description: string;
  /** Rappel de l'effet financier (ex. montant restitué, facture annulée). */
  effetFinancier?: string;
  /** Numéro du document à retaper pour activer le bouton (ex. n° de facture). */
  requireText?: string;
  requireLabel?: string;
  requirePlaceholder?: string;
  /** Champ motif (ex. motif d'annulation obligatoire). */
  motifLabel?: string;
  motifPlaceholder?: string;
  motifRequired?: boolean;
  confirmLabel?: string;
  loading?: boolean;
  /** Erreur du serveur, affichée en haut. */
  error?: string | null;
  /** Motif saisi transmis à l'action ("" si aucun champ motif). */
  onConfirm: (motif: string) => void | Promise<void>;
}

/**
 * Confirmation destructive : bouton rouge, rappel de l'effet financier,
 * re-saisie du numéro du document (optionnelle) et motif (optionnel).
 * Le bouton reste désactivé tant que la re-saisie ne correspond pas.
 */
export function DangerConfirm({
  open, onOpenChange, title, description, effetFinancier,
  requireText, requireLabel, requirePlaceholder,
  motifLabel, motifPlaceholder, motifRequired,
  confirmLabel, loading, error, onConfirm,
}: DangerConfirmProps) {
  const { t } = useT();
  const [saisie, setSaisie] = useState("");
  const [motif, setMotif] = useState("");

  useEffect(() => {
    if (open) {
      setSaisie("");
      setMotif("");
    }
  }, [open ]);

  const retapeOk = !requireText || saisie.trim() === requireText.trim();
  const motifOk = !motifRequired || motif.trim() !== "";
  const pret = retapeOk && motifOk && !loading;

  return (
    <ModalShell
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="sm"
      busy={loading}
      error={error}
      icon={
        <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive [&_svg]:h-4 [&_svg]:w-4">
          <TriangleAlert aria-hidden />
        </span>
      }
      footer={
        <>
          <Button type="button" variant="outline" disabled={loading} onClick={() => onOpenChange(false)}>
            {t("commun.annuler")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!pret}
            title={!retapeOk ? t("modales.retape_requise") : undefined}
            onClick={() => void onConfirm(motif)}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            {confirmLabel ?? t("commun.confirmer")}
          </Button>
        </>
      }
    >
      {effetFinancier && (
        <p role="note" className="rounded-[10px] border border-[#b45309]/30 bg-[#b45309]/10 p-3 text-sm font-medium text-[#b45309] dark:text-[#e8b04a]">
          {effetFinancier}
        </p>
      )}
      {requireText && (
        <Field
          label={requireLabel ?? t("modales.retape_label", { numero: requireText })}
          htmlFor="danger-retape"
          hint={t("modales.retape_hint")}
          required
        >
          <Input
            id="danger-retape"
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            placeholder={requirePlaceholder ?? requireText}
            autoComplete="off"
            aria-invalid={!retapeOk}
          />
        </Field>
      )}
      {motifLabel && (
        <Field
          label={motifLabel}
          htmlFor="danger-motif"
          required={motifRequired}
        >
          <Textarea
            id="danger-motif"
            rows={3}
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder={motifPlaceholder}
          />
        </Field>
      )}
    </ModalShell>
  );
}
