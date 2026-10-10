"use client";

import { UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAvatar } from "@/lib/avatar";
import { useT } from "@/lib/i18n/contexte";

const TAILLES = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-16 w-16",
  xl: "h-24 w-24",
} as const;

/**
 * Photo de profil d'un utilisateur, ou icône par défaut s'il n'en a pas définie.
 * La photo est choisie par l'utilisateur lui-même dans « Mon profil ».
 */
export function AvatarUtilisateur({
  idUtilisateur,
  nom,
  photo,
  taille = "md",
  className,
}: {
  /** Id pour lire la photo stockée localement (ignoré si `photo` est fournie). */
  idUtilisateur?: number | null;
  nom?: string;
  /** Photo imposée (ex. prévisualisation avant enregistrement). */
  photo?: string | null;
  taille?: keyof typeof TAILLES;
  className?: string;
}) {
  const stockee = useAvatar(photo ? null : (idUtilisateur ?? null));
  const src = photo ?? stockee;
  const { t } = useT();
  const libelle = nom ? t("commun.avatar.photo_nom", { nom }) : t("commun.avatar.photo");

  if (src) {
    return (
      // dataURL locale : next/image n'apporte aucune optimisation ici.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={libelle}
        className={cn("shrink-0 rounded-full object-cover ring-1 ring-border", TAILLES[taille], className)}
      />
    );
  }
  return (
    <span
      role="img"
      aria-label={nom ? t("commun.avatar.defaut_nom", { nom }) : t("commun.avatar.defaut")}
      title={nom || t("commun.avatar.defaut")}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground ring-1 ring-border",
        TAILLES[taille],
        className,
      )}
    >
      <UserRound className="h-1/2 w-1/2" aria-hidden />
    </span>
  );
}
