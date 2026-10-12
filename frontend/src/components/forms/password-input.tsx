"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const NIVEAUX = [
  { label: "Très faible", classe: "bg-destructive" },
  { label: "Faible", classe: "bg-[#b45309]" },
  { label: "Moyen", classe: "bg-[#e8b04a]" },
  { label: "Fort", classe: "bg-[#15803d]" },
];

/** Score 0–4 : longueur ≥ 8, minuscule + majuscule, chiffre, caractère spécial. */
export function forceMotDePasse(mot: string): number {
  if (!mot) return 0;
  let score = 0;
  if (mot.length >= 8) score += 1;
  if (/[a-z]/.test(mot) && /[A-Z]/.test(mot)) score += 1;
  if (/\d/.test(mot)) score += 1;
  if (/[^A-Za-z0-9]/.test(mot)) score += 1;
  return score;
}

interface PasswordInputProps
  extends Omit<React.ComponentProps<"input">, "type"> {
  /** Affiche l'indicateur de force sous le champ (défaut : oui). */
  showStrength?: boolean;
  showLabel?: string;
  hideLabel?: string;
}

/**
 * Mot de passe : œil afficher/masquer (bouton-icône avec aria-label) +
 * indicateur de force en 4 niveaux, annoncé aux lecteurs d'écran.
 */
export function PasswordInput({
  showStrength = true,
  showLabel = "Afficher le mot de passe",
  hideLabel = "Masquer le mot de passe",
  value, className, id, ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const texte = typeof value === "string" ? value : "";
  const score = forceMotDePasse(texte);
  const niveau = NIVEAUX[Math.max(0, score - 1)] ?? NIVEAUX[0];

  return (
    <span className="block">
      <span className="relative block">
        <Input
          {...props}
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          autoComplete={props.autoComplete ?? "new-password"}
          className={cn("pr-10", className)}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? hideLabel : showLabel}
          title={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          className="absolute top-1/2 right-1.5 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
        </button>
      </span>
      {showStrength && texte.length > 0 && (
        <span className="mt-1.5 flex items-center gap-2" role="status" aria-live="polite">
          <span className="flex flex-1 gap-1" aria-hidden>
            {[1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={cn(
                  "h-1 flex-1 rounded-full",
                  i <= score ? niveau.classe : "bg-muted",
                )}
              />
            ))}
          </span>
          <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
            {niveau.label}
          </span>
        </span>
      )}
    </span>
  );
}
