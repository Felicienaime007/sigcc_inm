"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClientSearch } from "@/components/clients/client-search";
import { Field } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { versNombre } from "@/lib/clients";
import { aujourdhui } from "@/lib/dates";
import { getErrorMessage } from "@/lib/errors";
import { formatAr, formatDate } from "@/lib/format";
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

  // Lignes du budget de l'organisme du SOA choisi
  const organismeId = client?.organisme ?? null;
  const lignes = useOptions<LigneBudget>("budget/lignes", { organisme: organismeId }, !edition && organismeId !== null);
  const ligne = lignes.data?.find((l) => l.id_ligne_budget === ligneId);

  const m = versNombre(montant);
  const montantValide = montant.trim() !== "" && Number.isFinite(m) && m > 0;
  const disponible = ligne ? Number(ligne.montant_disponible) : null;
  const insuffisant = !edition && montantValide && disponible !== null && Math.round(m * 100) > Math.round(disponible * 100);

  async function envoyer() {
    setErreur(null);
    if (!numero.trim()) return setErreur("Le numéro d'engagement du Contrôle financier est obligatoire.");
    if (!dateVisa) return setErreur("La date de visa est obligatoire.");
    if (dateVisa > aujourdhui()) return setErreur("La date de visa ne peut pas être dans le futur.");

    try {
      if (edition) {
        await crud.update.mutateAsync({
          id: engagement.id_engagement,
          body: { num_engagement_cf: numero.trim(), date_visa_cf: dateVisa },
        });
      } else {
        if (!client) return setErreur("Sélectionnez le SOA bénéficiaire.");
        if (!ligne) return setErreur("Choisissez la ligne budgétaire.");
        if (!montantValide) return setErreur("Le montant doit être supérieur à 0.");
        if (insuffisant) return setErreur(`Crédit insuffisant : disponible ${formatAr(disponible)}.`);
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
      title={edition ? `Corriger l'engagement ${engagement.num_engagement_cf}` : "Nouvel engagement budgétaire"}
      description={
        edition
          ? "Seuls le numéro du Contrôle financier et la date de visa sont modifiables. Pour changer le montant, la ligne ou le SOA : annulez l'engagement puis recréez-le."
          : "À enregistrer après le visa du Contrôle financier. Le montant est immédiatement déduit du crédit de la ligne."
      }
      onSubmit={(e) => { e?.preventDefault(); void envoyer(); }}
      submitting={crud.create.isPending || crud.update.isPending}
      error={erreur}
      submitLabel={edition ? "Enregistrer" : "Enregistrer l'engagement"}
      wide
    >
      {edition ? (
        <div className="grid gap-3 rounded-md border bg-muted/30 p-3 text-sm sm:grid-cols-2">
          <div><p className="text-xs text-muted-foreground">SOA</p><p className="font-medium">{engagement.nom_client}</p></div>
          <div><p className="text-xs text-muted-foreground">Ligne budgétaire</p>
            <p className="font-medium">Article {engagement.code_article} · {engagement.annee_budgetaire}</p></div>
          <div><p className="text-xs text-muted-foreground">Organisme</p><p className="font-medium">{engagement.nom_organisme}</p></div>
          <div><p className="text-xs text-muted-foreground">Montant engagé</p>
            <p className="font-medium tabular-nums">{formatAr(engagement.montant_engage)}</p></div>
        </div>
      ) : (
        <>
          <Field label="SOA bénéficiaire" hint="Ministère ou collectivité (code SOA). Son organisme détermine le budget à utiliser.">
            <ClientSearch
              value={client}
              onChange={(c) => { setClient(c); setLigneId(null); }}
              params={{ soa: "true" }}
            />
          </Field>

          <Field label="Ligne budgétaire">
            <Select
              value={ligneId !== null ? String(ligneId) : ""}
              onValueChange={(v) => setLigneId(Number(v))}
              disabled={organismeId === null || lignes.isLoading}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={
                  client === null ? "Choisissez d'abord le SOA…"
                    : lignes.isLoading ? "Chargement…" : "Choisir la ligne…"
                } />
              </SelectTrigger>
              <SelectContent>
                {(lignes.data ?? []).map((l) => (
                  <SelectItem key={l.id_ligne_budget} value={String(l.id_ligne_budget)}>
                    {l.code_article} — {l.libelle_ligne} · {l.annee_budgetaire} · dispo {formatAr(l.montant_disponible)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {client !== null && !lignes.isLoading && (lignes.data?.length ?? 0) === 0 && (
              <p className="mt-1 text-xs text-amber-700">
                L'organisme « {client.nom_organisme} » n'a aucune ligne budgétaire : créez d'abord son budget.
              </p>
            )}
          </Field>

          <Field label="Montant à engager (Ar)" htmlFor="montant_engage">
            <Input id="montant_engage" inputMode="decimal" value={montant} onChange={(e) => setMontant(e.target.value)} />
            {ligne && (
              <p className={`mt-1 text-xs ${insuffisant ? "text-destructive" : "text-muted-foreground"}`}>
                {insuffisant ? (
                  <span className="inline-flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> Crédit insuffisant : disponible {formatAr(ligne.montant_disponible)}.
                  </span>
                ) : (
                  <>
                    Disponible : {formatAr(ligne.montant_disponible)}
                    {montantValide && <> → après engagement : {formatAr(disponible! - m)}</>}
                  </>
                )}
              </p>
            )}
          </Field>
        </>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="N° d'engagement (Contrôle financier)" htmlFor="num_cf" hint="Unique.">
          <Input id="num_cf" value={numero} onChange={(e) => setNumero(e.target.value)} maxLength={100} />
        </Field>
        <Field label="Date de visa du CF" htmlFor="date_visa">
          <Input id="date_visa" type="date" value={dateVisa} max={aujourdhui()} onChange={(e) => setDateVisa(e.target.value)} />
        </Field>
      </div>
      {edition && <p className="text-xs text-muted-foreground">Visé le {formatDate(engagement.date_visa_cf)}.</p>}
    </FormDialog>
  );
}