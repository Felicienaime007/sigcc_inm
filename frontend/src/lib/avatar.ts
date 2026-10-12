"use client";

/**
 * Photo de profil stockée en base (champ `photo` de l'utilisateur, exposé
 * par /auth/me/ et les listes). Le navigateur ne sert plus de stockage :
 * vider le stockage ne fait plus disparaître la photo.
 *
 * Les deux fonctions `lireAvatar`/`retirerAvatar` ne servent qu'à la
 * migration unique des photos restées dans le localStorage (clé par
 * utilisateur) vers le serveur, sur la page « Mon profil ».
 */
const PREFIXE_CLE = "sigcc-avatar-";
const TAILLE_MAX_PX = 256;
const POIDS_MAX_OCTETS = 2 * 1024 * 1024;

function cle(id: number) {
  return `${PREFIXE_CLE}${id}`;
}

/** Photo restée dans l'ancien stockage local, ou null. */
export function lireAvatar(id: number | null | undefined): string | null {
  if (id == null || typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(cle(id));
  } catch {
    return null;
  }
}

/** Oublie la photo de l'ancien stockage local (après migration vers le serveur). */
export function retirerAvatar(id: number) {
  try {
    localStorage.removeItem(cle(id));
  } catch {
    /* stockage indisponible : sans conséquence */
  }
}

/**
 * Redimensionne une image (≤ 256 px) et la renvoie en dataURL JPEG légère,
 * prête à être envoyée au serveur.
 */
export function compresserImage(fichier: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!fichier.type.startsWith("image/")) {
      reject(new Error("Le fichier doit être une image (JPG, PNG…)."));
      return;
    }
    if (fichier.size > POIDS_MAX_OCTETS) {
      reject(new Error("Image trop lourde : 2 Mo maximum."));
      return;
    }
    const url = URL.createObjectURL(fichier);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const ratio = Math.min(1, TAILLE_MAX_PX / Math.max(img.width, img.height));
      const largeur = Math.max(1, Math.round(img.width * ratio));
      const hauteur = Math.max(1, Math.round(img.height * ratio));
      const canvas = document.createElement("canvas");
      canvas.width = largeur;
      canvas.height = hauteur;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Impossible de traiter l'image."));
        return;
      }
      ctx.drawImage(img, 0, 0, largeur, hauteur);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Fichier image illisible."));
    };
    img.src = url;
  });
}
