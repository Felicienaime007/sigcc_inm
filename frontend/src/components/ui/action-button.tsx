"use client";

import { LoaderCircle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export interface ActionButtonProps
  extends Omit<React.ComponentProps<"button">, "disabled">,
    VariantProps<typeof buttonVariants> {
  /** Icône affichée avant le libellé (remplacée par le spinner si loading). */
  icon?: React.ReactNode;
  /** État de chargement : spinner centré, largeur inchangée, clic bloqué, aria-busy. */
  loading?: boolean;
  /** Raison de désactivation : bouton désactivé + infobulle explicative. */
  disabledReason?: string;
  /** Raccourci clavier affiché dans l'infobulle, ex. "Ctrl+Entrée". */
  shortcut?: string;
  /** Texte de l'infobulle (native, title). */
  tooltip?: string;
  /** Désactivation simple (sans explication). */
  disabled?: boolean;
}

/**
 * Bouton d'action SaaS : chargement sans changement de largeur,
 * désactivation expliquée, raccourci documenté dans l'infobulle.
 * Contrats inchangés : les mêmes variant/size que Button.
 */
export function ActionButton({
  icon,
  loading,
  disabledReason,
  shortcut,
  tooltip,
  disabled,
  variant,
  size,
  className,
  type = "button",
  children,
  ...props
}: ActionButtonProps) {
  const bloque = disabled || loading || !!disabledReason;
  const infobulle = [tooltip, shortcut, disabledReason].filter(Boolean).join(" · ") || undefined;

  const bouton = (
    <Button
      variant={variant}
      size={size}
      type={type}
      disabled={bloque}
      aria-busy={loading || undefined}
      title={disabledReason ? undefined : infobulle}
      className={cn(loading && "relative", className)}
      {...props}
    >
      <span className={cn("contents", loading && "invisible")}>
        {icon}
        {children}
      </span>
      {loading && (
        <span aria-hidden className="absolute inset-0 grid place-items-center">
          <LoaderCircle className="animate-spin" />
        </span>
      )}
    </Button>
  );

  // Un bouton désactivé ne reçoit pas de survol : l'infobulle vit sur l'enveloppe.
  if (disabledReason) {
    return (
      <span title={infobulle} className="inline-flex cursor-not-allowed">
        {bouton}
      </span>
    );
  }
  return bouton;
}

export interface IconButtonProps extends Omit<ActionButtonProps, "tooltip" | "children" | "icon" | "size"> {
  /** Infobulle OBLIGATOIRE (erreur TypeScript si absente). */
  tooltip: string;
  /** Libellé accessible OBLIGATOIRE (erreur TypeScript si absent). */
  "aria-label": string;
  children: React.ReactNode;
  size?: VariantProps<typeof buttonVariants>["size"];
}

/** Bouton-icône : infobulle et aria-label exigés par le typage. */
export function IconButton({ tooltip, shortcut, size = "icon", ...props }: IconButtonProps) {
  const infobulle = shortcut ? `${tooltip} (${shortcut})` : tooltip;
  return <ActionButton tooltip={infobulle} size={size} {...props} />;
}
