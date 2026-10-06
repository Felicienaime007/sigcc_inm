"use client";

import { UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAvatar } from "@/lib/avatar";

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
  const libelle = nom ? `Photo de profil de ${nom}` : "Photo de profil";

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
      aria-label={nom ? `Profil par défaut de ${nom}` : "Profil par défaut"}
      title={nom || "Profil par défaut"}
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
