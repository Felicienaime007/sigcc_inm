"use client";

import { useEffect, useState } from "react";

/**
 * Photo de profil stockée côté navigateur (localStorage, clé par utilisateur).
 * Le backend n'expose aucun champ photo : l'admin voit donc l'icône par défaut
 * et chaque utilisateur choisit sa photo dans son espace « Mon profil ».
 */
const PREFIXE_CLE = "sigcc-avatar-";
export const EVENEMENT_AVATAR = "sigcc-avatar-change";
const TAILLE_MAX_PX = 256;
const POIDS_MAX_OCTETS = 2 * 1024 * 1024;

function cle(id: number) {
  return `${PREFIXE_CLE}${id}`;
}

export function lireAvatar(id: number | null | undefined): string | null {
  if (id == null || typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(cle(id));
  } catch {
    return null;
  }
}

function notifier(id: number) {
  window.dispatchEvent(new CustomEvent(EVENEMENT_AVATAR, { detail: { id } }));
}

export function enregistrerAvatar(id: number, dataUrl: string) {
  localStorage.setItem(cle(id), dataUrl);
  notifier(id);
}

export function retirerAvatar(id: number) {
  localStorage.removeItem(cle(id));
  notifier(id);
}

/** Photo de l'utilisateur, réactive aux changements (même onglet ou autre onglet). */
export function useAvatar(id: number | null | undefined) {
  // Photo nulle au premier rendu (identique au SSR : pas d'erreur
  // d'hydratation) ; la photo stockée est lue juste après le montage.
  const [etat, setEtat] = useState<{ id: number | null | undefined; photo: string | null }>(() => ({
    id,
    photo: null,
  }));
  if (etat.id !== id) setEtat({ id, photo: null });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEtat({ id, photo: lireAvatar(id) });
    const rafraichir = (e: Event) => {
      const detail = (e as CustomEvent<{ id?: number }>).detail;
      if (!detail || detail.id === id) setEtat((p) => ({ ...p, photo: lireAvatar(id) }));
    };
    window.addEventListener(EVENEMENT_AVATAR, rafraichir);
    window.addEventListener("storage", rafraichir);
    return () => {
      window.removeEventListener(EVENEMENT_AVATAR, rafraichir);
      window.removeEventListener("storage", rafraichir);
    };
  }, [id]);

  return etat.photo;
}

/**
 * Redimensionne une image (≤ 256 px) et la renvoie en dataURL JPEG légère,
 * stockable dans le localStorage.
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
