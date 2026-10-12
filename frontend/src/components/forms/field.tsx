import { CircleAlert } from "lucide-react";
import { Label } from "@/components/ui/label";

/** Libellé + champ + aide + message d'erreur (validation locale ou erreur du serveur). */
export function Field({
  label, htmlFor, error, hint, children, required, maxLength, valueLength,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  /** Champ obligatoire : astérisque + aria sur le libellé. */
  required?: boolean;
  /** Longueur maximale : affiche le compteur « n/max » (avec valueLength). */
  maxLength?: number;
  /** Longueur actuelle du contenu (pour le compteur de caractères). */
  valueLength?: number;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={htmlFor} className="text-[13px] font-semibold">
          {label}
          {required && (
            <span aria-hidden className="ml-1 font-bold text-destructive">*</span>
          )}
          {required && <span className="sr-only"> (obligatoire)</span>}
        </Label>
        {maxLength !== undefined && (
          <span
            className="shrink-0 text-[11px] text-muted-foreground tabular-nums"
            aria-live="polite"
          >
            {valueLength ?? 0}/{maxLength}
          </span>
        )}
      </div>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-[13px] font-medium text-destructive">
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
