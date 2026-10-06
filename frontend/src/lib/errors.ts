import { isAxiosError } from "axios";

function aplatir(data: unknown): string[] {
  if (typeof data === "string") return [data];
  if (Array.isArray(data)) return data.flatMap(aplatir);
  if (data && typeof data === "object") {
    return Object.entries(data as Record<string, unknown>).flatMap(([cle, val]) =>
      aplatir(val).map((m) => (cle === "detail" || cle === "non_field_errors" ? m : `${cle} : ${m}`)),
    );
  }
  return [];
}

/** Transforme une erreur axios / DRF en message lisible. */
export function getErrorMessage(err: unknown, fallback = "Une erreur est survenue."): string {
  if (!isAxiosError(err)) return fallback;
  if (!err.response) return "Serveur injoignable. Vérifiez la connexion.";
  const { status, data } = err.response;
  if (status >= 500) return "Erreur du serveur. Réessayez ou contactez l'administrateur.";
  if (typeof data === "string") return fallback; // page HTML d'erreur

  // Réservation d'une préparation : liste des produits manquants
  const manques = (data as { manques?: unknown } | null)?.manques;
  if (Array.isArray(manques)) {
    const liste = (manques as { produit?: unknown; manquant?: unknown }[])
      .map((m) => `${m.produit} (manque ${m.manquant})`)
      .join(", ");
    const detail = aplatir((data as { detail?: unknown }).detail).join(" ");
    return `${detail || "Stock insuffisant."} Manque : ${liste}.`;
  }

  const messages = aplatir(data);
  return messages.length ? messages.join(" — ") : fallback;
}

/** Erreurs par champ d'un 400 DRF : {champ: "message"} (pour react-hook-form, étape F2). */
export function getFieldErrors(err: unknown): Record<string, string> {
  if (!isAxiosError(err) || err.response?.status !== 400) return {};
  const data = err.response.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  return Object.fromEntries(
    Object.entries(data as Record<string, unknown>).map(([k, v]) => [k, aplatir(v).join(" ")]),
  );
}