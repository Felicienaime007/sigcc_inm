"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClientSearch } from "@/components/clients/client-search";
import { Field } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { useAuth } from "@/lib/auth-context";
import { estSoa } from "@/lib/clients";
import { getErrorMessage } from "@/lib/errors";
import { formatAr, formatDate, formatNombre } from "@/lib/format";
import { useCrud, useDetail, useOptions } from "@/lib/resource";
import type { Client } from "@/types/clients";
import type { Commande, Devis, EngagementLight } from "@/types/commercial";
import { LignesEditor, totalEdition, verifierLignes, versApi, type LigneEdit } from "./lignes-editor";

const AUCUN = "__aucun__";

/**
 * Création (commande = null) ou modification d'une commande BROUILLON.
 * `initialClientId` / `initialDevisId` : création à partir d'un devis.
 */
export function CommandeDialog({
  commande, initialClientId, initialDevisId, onClose, onSaved,
}: {
  commande: Commande | null;
  initialClientId?: number;
  initialDevisId?: number;
  onClose: () => void;
  onSaved?: (commande: Commande) => void;
}) {
  const { can } = useAuth();
  const edition = commande !== null;
  const crud = useCrud<Commande, Record<string, unknown>>("commercial/commandes");

  const [client, setClient] = useState<Client | null>(null);
  const [devisId, setDevisId] = useState<number | null>(initialDevisId ?? null);
  const [engagementId, setEngagementId] = useState<number | null>(commande?.engagement ?? null);
  const [lignes, setLignes] = useState<LigneEdit[]>(
    commande?.lignes.map((l) => ({
      produit: {
        id_produit: l.produit, code_produit: l.code_produit, designation: l.designation,
        prix_tarif: l.prix_unitaire_facture,
      },
      quantite: String(l.quantite_commandee),
      prix: String(Number(l.prix_unitaire_facture)),
    })) ?? [],
  );
  const [erreur, setErreur] = useState<string | null>(null);

  // Création à partir d'un devis : on charge le client du devis
  const initial = useDetail<Client>("clients/clients", !edition && initialClientId ? initialClientId : null);
  useEffect(() => {
    if (initial.data) setClient((c) => c ?? initial.data!);
  }, [initial.data]);

  const clientId = commande ? commande.client : (client?.id_client ?? null);
  const clientType = commande ? commande.type_client : (client?.type_client ?? null);
  const soa = clientType !== null && estSoa(clientType);

  // Devis disponibles : du client, pas encore convertis, pas expirés
  const devisOptions = useOptions<Devis>(
    "commercial/devis", { client: clientId }, !edition && clientId !== null && can("devis.view"),
  );
  const devisDispo = (devisOptions.data ?? []).filter((d) => !d.id_commande && !d.est_expire);
  const devisChoisi = devisDispo.find((d) => d.id_devis === devisId);

  // Engagements visés du SOA, pas encore rattachés à une commande
  const engagementsQuery = useOptions<EngagementLight>(
    "budget/engagements",
    { client: clientId, statut: "VISE", libre: "true" },
    soa && clientId !== null && can("engagement.view"),
  );
  const engagements = useMemo(() => {
    const liste = [...(engagementsQuery.data ?? [])];
    // En modification, l'engagement déjà rattaché à cette commande doit rester sélectionnable
    if (commande?.engagement && !liste.some((e) => e.id_engagement === commande.engagement)) {
      liste.unshift({
        id_engagement: commande.engagement, num_engagement_cf: commande.num_engagement_cf ?? "",
        montant_engage: "", code_article: "", annee_budgetaire: 0, statut_engagement: "VISE", id_commande: commande.id_commande,
      });
    }
    return liste;
  }, [engagementsQuery.data, commande]);
  const engagementChoisi = engagements.find((e) => e.id_engagement === engagementId);

  const total = devisChoisi ? Number(devisChoisi.total) : totalEdition(lignes);
  const depasse = engagementChoisi?.montant_engage && total > Number(engagementChoisi.montant_engage);

  async function envoyer() {
    setErreur(null);
    if (!edition && clientId === null) return setErreur("Sélectionnez le client.");
    if (devisId === null) {
      const e = verifierLignes(lignes, true);
      if (e) return setErreur(e);
    }
    const lignesApi = versApi(lignes, "quantite_commandee", "prix_unitaire_facture");
    try {
      const saved = edition
        ? await crud.update.mutateAsync({
            id: commande.id_commande,
            body: { engagement: soa ? engagementId : null, lignes: lignesApi },
          })
        : await crud.create.mutateAsync({
            client: clientId,
            ...(devisId !== null ? { devis: devisId } : { lignes: lignesApi }),
            ...(soa && engagementId !== null ? { engagement: engagementId } : {}),
          });
      onSaved?.(saved as Commande);
      onClose();
    } catch (err) {
      setErreur(getErrorMessage(err));
    }
  }

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={edition ? `Modifier la commande ${commande.num_commande}` : "Nouvelle commande"}
      description="La commande est créée en brouillon ; elle sera contrôlée à la validation (engagement pour un SOA, solvabilité pour un client privé)."
      onSubmit={(e) => { e?.preventDefault(); void envoyer(); }}
      submitting={crud.create.isPending || crud.update.isPending}
      error={erreur}
      submitLabel={edition ? "Enregistrer" : "Créer la commande"}
      wide
    >
      <Field label="Client">
        {edition ? (
          <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm">{commande.nom_client}</div>
        ) : (
          <ClientSearch
            value={client}
            onChange={(c) => { setClient(c); setDevisId(null); setEngagementId(null); }}
            exclureTypes={["SIMPLE"]}
          />
        )}
      </Field>

      {!edition && clientId !== null && devisDispo.length > 0 && (
        <Field label="Devis source (facultatif)" hint="Les lignes et les prix du devis sont repris tels quels.">
          <Select
            value={devisId !== null ? String(devisId) : AUCUN}
            onValueChange={(v) => setDevisId(v === AUCUN ? null : Number(v))}
          >
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={AUCUN}>— Aucun (commande directe) —</SelectItem>
              {devisDispo.map((d) => (
                <SelectItem key={d.id_devis} value={String(d.id_devis)}>
                  {d.num_devis} · {formatAr(d.total)} · valable jusqu'au {formatDate(d.date_expiration)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
      {edition && commande.num_devis && (
        <p className="text-sm text-muted-foreground">Devis source : {commande.num_devis}</p>
      )}

      {soa && (
        <Field
          label="Engagement budgétaire"
          hint="Obligatoire pour valider la commande d'un SOA. Seuls les engagements visés, libres, de ce SOA sont proposés."
        >
          <Select
            value={engagementId !== null ? String(engagementId) : AUCUN}
            onValueChange={(v) => setEngagementId(v === AUCUN ? null : Number(v))}
            disabled={clientId === null}
          >
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={AUCUN}>— Aucun pour l'instant —</SelectItem>
              {engagements.map((e) => (
                <SelectItem key={e.id_engagement} value={String(e.id_engagement)}>
                  {e.num_engagement_cf}
                  {e.montant_engage ? ` · ${formatAr(e.montant_engage)} · article ${e.code_article}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {clientId !== null && !engagementsQuery.isLoading && engagements.length === 0 && (
            <p className="mt-1 text-xs text-amber-700">
              Aucun engagement visé et libre pour ce SOA : demandez au comptable d'en enregistrer un.
            </p>
          )}
        </Field>
      )}

      {clientType === "PRIVE" && client?.solvabilite && (
        <p className="rounded-md bg-muted/40 p-3 text-sm">
          Plafond d'encours : <span className="font-medium">{formatAr(client.solvabilite.plafond_encours)}</span>
          {client.solvabilite.statut_blocage && <span className="ml-2 font-medium text-destructive">· client bloqué</span>}
        </p>
      )}
      {clientType === "PRIVE" && client && !client.solvabilite && (
        <p className="flex items-center gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4" /> Ce client privé n'a pas de fiche de solvabilité : la validation sera refusée.
        </p>
      )}

      <Field label="Lignes de la commande">
        {devisId !== null ? (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produit</TableHead>
                  <TableHead className="text-right">Quantité</TableHead>
                  <TableHead className="text-right">Prix unitaire</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(devisChoisi?.lignes ?? []).map((l) => (
                  <TableRow key={l.produit}>
                    <TableCell>{l.designation} <span className="text-xs text-muted-foreground">({l.code_produit})</span></TableCell>
                    <TableCell className="text-right tabular-nums">{formatNombre(l.quantite)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatAr(l.prix_unitaire_devis)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <LignesEditor lignes={lignes} onChange={setLignes} avecPrix />
        )}
      </Field>

      <div className="text-right text-sm">
        <p>Total HT : <span className="font-semibold tabular-nums">{formatAr(total)}</span></p>
        {depasse && (
          <p className="mt-1 flex items-center justify-end gap-1 text-amber-700">
            <AlertTriangle className="h-4 w-4" />
            Le total dépasse le montant engagé ({formatAr(engagementChoisi!.montant_engage)}) : la validation sera refusée.
          </p>
        )}
      </div>
    </FormDialog>
  );
}