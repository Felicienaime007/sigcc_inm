"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClientSearch } from "@/components/clients/client-search";
import { Field } from "@/components/forms/field";
import { AmountInput } from "@/components/forms/amount-input";
import { FormDialog } from "@/components/forms/form-dialog";
import { versNombre } from "@/lib/clients";
import { aujourdhui } from "@/lib/dates";
import { getErrorMessage } from "@/lib/errors";
import { formatAr, formatDate } from "@/lib/format";
import { useT } from "@/lib/i18n/contexte";
import { useCrud, useOptions } from "@/lib/resource";
import type { Client } from "@/types/clients";
import type { Engagement, LigneBudget } from "@/types/budget";

/**
 * Création (engagement = null) ou correction d'un engagement visé par le Contrôle financier.
 * En correction, seuls le n° du CF et la date de visa sont modifiables.
 */
export function EngagementDialog({
  engagement, onClose,
}: {
  engagement: Engagement | null;
  onClose: () => void;
}) {
  const edition = engagement !== null;
  const crud = useCrud<Engagement, Record<string, unknown>>("budget/engagements");

  const [client, setClient] = useState<Client | null>(null);
  const [ligneId, setLigneId] = useState<number | null>(null);
  const [numero, setNumero] = useState(engagement?.num_engagement_cf ?? "");
  const [montant, setMontant] = useState("");
  const [dateVisa, setDateVisa] = useState(engagement?.date_visa_cf ?? aujourdhui());
  const [erreur, setErreur] = useState<string | null>(null);
  const { t } = useT();

  // Lignes du budget de l'organisme du SOA choisi
  const organismeId = client?.organisme ?? null;
  const lignes = useOptions<LigneBudget>("budget/lignes", { organisme: organismeId }, !edition && organismeId !== null);
  const ligne = lignes.data?.find((l) => l.id_ligne_budget === ligneId);
  const libelleLigne = (l: LigneBudget) =>
    t("budget.edlg.option_ligne", {
      code: l.code_article, libelle: l.libelle_ligne, annee: l.annee_budgetaire,
      dispo: formatAr(l.montant_disponible),
    });

  const m = versNombre(montant);
  const montantValide = montant.trim() !== "" && Number.isFinite(m) && m > 0;
  const disponible = ligne ? Number(ligne.montant_disponible) : null;
  const insuffisant = !edition && montantValide && disponible !== null && Math.round(m * 100) > Math.round(disponible * 100);

  async function envoyer() {
    setErreur(null);
    if (!numero.trim()) return setErreur(t("budget.edlg.err_numero"));
    if (!dateVisa) return setErreur(t("budget.edlg.err_date"));
    if (dateVisa > aujourdhui()) return setErreur(t("budget.edlg.err_futur"));

    try {
      if (edition) {
        await crud.update.mutateAsync({
          id: engagement.id_engagement,
          body: { num_engagement_cf: numero.trim(), date_visa_cf: dateVisa },
        });
      } else {
        if (!client) return setErreur(t("budget.edlg.err_soa"));
        if (!ligne) return setErreur(t("budget.edlg.err_ligne"));
        if (!montantValide) return setErreur(t("budget.edlg.err_montant"));
        if (insuffisant) return setErreur(t("budget.edlg.err_insuffisant", { dispo: formatAr(disponible) }));
        await crud.create.mutateAsync({
          num_engagement_cf: numero.trim(),
          montant_engage: Math.round(m * 100) / 100,
          date_visa_cf: dateVisa,
          ligne_budget: ligne.id_ligne_budget,
          client: client.id_client,
        });
      }
      onClose();
    } catch (e) {
      setErreur(getErrorMessage(e));
    }
  }

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={edition ? t("budget.edlg.titre_modif", { num: engagement.num_engagement_cf }) : t("budget.edlg.titre_nouveau")}
      description={
        edition
          ? t("budget.edlg.desc_modif")
          : t("budget.edlg.desc_nouveau")
      }
      onSubmit={(e) => { e?.preventDefault(); void envoyer(); }}
      submitting={crud.create.isPending || crud.update.isPending}
      error={erreur}
      submitLabel={edition ? t("budget.edlg.enregistrer") : t("budget.edlg.enregistrer_engagement")}
      wide
    >
      {edition ? (
        <div className="grid gap-3 rounded-md border bg-muted/30 p-3 text-sm sm:grid-cols-2">
          <div><p className="text-xs text-muted-foreground">{t("budget.edlg.soa")}</p><p className="font-medium">{engagement.nom_client}</p></div>
          <div><p className="text-xs text-muted-foreground">{t("budget.edlg.ligne")}</p>
            <p className="font-medium">{t("budget.edlg.ligne_valeur", { code: engagement.code_article, annee: engagement.annee_budgetaire })}</p></div>
          <div><p className="text-xs text-muted-foreground">{t("budget.edlg.organisme")}</p><p className="font-medium">{engagement.nom_organisme}</p></div>
          <div><p className="text-xs text-muted-foreground">{t("budget.edlg.montant_engage")}</p>
            <p className="font-medium tabular-nums">{formatAr(engagement.montant_engage)}</p></div>
        </div>
      ) : (
        <>
          <Field label={t("budget.edlg.soa_benef")} hint={t("budget.edlg.soa_benef_hint")}>
            <ClientSearch
              value={client}
              onChange={(c) => { setClient(c); setLigneId(null); }}
              params={{ soa: "true" }}
            />
          </Field>

          <Field label={t("budget.edlg.ligne_choix")}>
            <Select
              value={ligneId !== null ? String(ligneId) : ""}
              onValueChange={(v) => setLigneId(Number(v))}
              disabled={organismeId === null || lignes.isLoading}
              items={Object.fromEntries((lignes.data ?? []).map((l) => [String(l.id_ligne_budget), libelleLigne(l)]))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={
                  client === null ? t("budget.edlg.choisir_soa_dabord")
                    : lignes.isLoading ? t("budget.edlg.chargement") : t("budget.edlg.choisir_ligne")
                } />
              </SelectTrigger>
              <SelectContent>
                {(lignes.data ?? []).map((l) => (
                  <SelectItem key={l.id_ligne_budget} value={String(l.id_ligne_budget)}>
                    {libelleLigne(l)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {client !== null && !lignes.isLoading && (lignes.data?.length ?? 0) === 0 && (
              <p className="mt-1 text-xs text-amber-700">
                {t("budget.edlg.sans_ligne", { org: client.nom_organisme ?? "" })}
              </p>
            )}
          </Field>

          <Field label={t("budget.edlg.montant")} htmlFor="montant_engage">
            <AmountInput
              id="montant_engage"
              value={montant.trim() === "" ? null : versNombre(montant)}
              onChange={(v) => setMontant(v === null ? "" : String(v))}
            />
            {ligne && (
              <p className={`mt-1 text-xs ${insuffisant ? "text-destructive" : "text-muted-foreground"}`}>
                {insuffisant ? (
                  <span className="inline-flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> {t("budget.edlg.credit_insuffisant", { dispo: formatAr(ligne.montant_disponible) })}
                  </span>
                ) : (
                  <>
                    {t("budget.edlg.disponible", { dispo: formatAr(ligne.montant_disponible) })}
                    {montantValide && <>{t("budget.edlg.apres_engagement", { reste: formatAr(disponible! - m) })}</>}
                  </>
                )}
              </p>
            )}
          </Field>
        </>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("budget.edlg.numero")} htmlFor="num_cf" hint={t("budget.edlg.numero_hint")}>
          <Input id="num_cf" value={numero} onChange={(e) => setNumero(e.target.value)} maxLength={100} />
        </Field>
        <Field label={t("budget.edlg.date_visa")} htmlFor="date_visa">
          <Input id="date_visa" type="date" value={dateVisa} max={aujourdhui()} onChange={(e) => setDateVisa(e.target.value)} />
        </Field>
      </div>
      {edition && <p className="text-xs text-muted-foreground">{t("budget.edlg.vise_le", { date: formatDate(engagement.date_visa_cf) })}</p>}
    </FormDialog>
  );
}