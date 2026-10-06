import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { getErrorMessage, getFieldErrors } from "./errors";

/**
 * Affiche les erreurs DRF sous leurs champs.
 * `alias` : {nom_champ_api: nom_champ_formulaire} quand les deux diffèrent.
 * Retourne le message général (erreur hors champ, 403, 409, serveur...) à afficher dans le dialogue, ou null.
 */
export function applyServerErrors<T extends FieldValues>(
  err: unknown,
  setError: UseFormSetError<T>,
  champs: string[],
  alias: Record<string, string> = {},
): string | null {
  const parChamp = getFieldErrors(err);
  if (Object.keys(parChamp).length === 0) return getErrorMessage(err);

  const generaux: string[] = [];
  for (const [cle, message] of Object.entries(parChamp)) {
    const cible = alias[cle] ?? cle;
    if (champs.includes(cible)) {
      setError(cible as Path<T>, { type: "server", message });
    } else if (cle === "detail" || cle === "non_field_errors") {
      generaux.push(message);
    } else {
      generaux.push(`${cle} : ${message}`);
    }
  }
  return generaux.length ? generaux.join(" — ") : null;
}