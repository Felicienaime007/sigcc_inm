import { toast } from "sonner";
import { api } from "./api";
import { getErrorMessageAsync } from "./errors";

/** Ouvre le PDF dans un nouvel onglet (téléchargé si le navigateur bloque les fenêtres). */
export async function ouvrirPdf(chemin: string, messages?: { generation?: string }): Promise<void> {
  // La fenêtre est ouverte tout de suite (pendant le clic) pour ne pas être bloquée
  const fenetre = window.open("", "_blank");
  const titre = messages?.generation ?? "Génération du document…";
  if (fenetre) {
    fenetre.document.title = titre;
    fenetre.document.body.innerHTML = `<p style='font-family:sans-serif;padding:2rem'>${titre}</p>`;
  }
  try {
    const { data } = await api.get<Blob>(`/editions/${chemin}/`, { responseType: "blob" });
    const url = URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
    if (fenetre) {
      fenetre.location.href = url;
    } else {
      const lien = document.createElement("a");
      lien.href = url;
      lien.download = `${chemin.replaceAll("/", "-")}.pdf`;
      lien.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
  } catch (e) {
    fenetre?.close();
    throw e;
  }
}

/** Ouvre le PDF et affiche l'erreur éventuelle en notification (pour les actions de toast). */
export async function imprimer(chemin: string, messages?: { generation?: string; document?: string }): Promise<void> {
  try {
    await ouvrirPdf(chemin, messages);
  } catch (e) {
    toast.error(await getErrorMessageAsync(e, messages?.document ?? "Impossible de générer le document."));
  }
}

/** Télécharge un état de synthèse (csv, xlsx ou pdf) avec ses filtres. */
export async function telechargerEtat(
  etat: "journal-ventes" | "balance-agee" | "encaissements",
  format: "csv" | "xlsx" | "pdf",
  params: Record<string, string> = {},
  messages?: { export?: string },
): Promise<void> {
  try {
    const { data } = await api.get<Blob>(`/editions/${etat}/`, {
      params: { ...params, export: format },
      responseType: "blob",
    });
    const url = URL.createObjectURL(new Blob([data]));
    const lien = document.createElement("a");
    lien.href = url;
    lien.download = `${etat}.${format}`;
    lien.click();
    setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
  } catch (e) {
    toast.error(await getErrorMessageAsync(e, messages?.export ?? "Impossible de générer l'export."));
  }
}