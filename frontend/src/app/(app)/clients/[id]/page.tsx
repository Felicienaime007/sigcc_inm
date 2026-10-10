"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Lock, LockOpen, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RequirePrivilege } from "@/components/can";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import { SolvabiliteDialog } from "@/components/clients/solvabilite-dialog";
import { TypeBadge } from "@/components/clients/type-badge";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { useAuth } from "@/lib/auth-context";
import { estSoa, peutGerer } from "@/lib/clients";
import { getErrorMessage } from "@/lib/errors";
import { formatAr, formatNombre } from "@/lib/format";
import { useT } from "@/lib/i18n/contexte";
import { useCrud, useDetail } from "@/lib/resource";
import type { Client, FicheSolvabilite } from "@/types/clients";

export default function ClientDetailPage() {
  return (
    <RequirePrivilege privilege={["client.view", "client_simple.view"]}>
      <Contenu />
    </RequirePrivilege>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm font-medium">{children ?? "—"}</div>
    </div>
  );
}

function Contenu() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useAuth();
  const { t } = useT();
  const { data: client, isLoading, error } = useDetail<Client>("clients/clients", id);
  const solvCrud = useCrud<FicheSolvabilite, { statut_blocage: number }>("clients/solvabilites");

  const [modifier, setModifier] = useState(false);
  const [solvOuvert, setSolvOuvert] = useState(false);
  const [confirmBlocage, setConfirmBlocage] = useState(false);

  // Paramètre pas encore résolu : pas de requête envoyée, pas de faux « introuvable »
  if (!id || isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error || !client) {
    return (
      <div className="space-y-3 py-16 text-center">
        <p className="text-destructive">{getErrorMessage(error, t("clients.detail.introuvable"))}</p>
        <Button variant="outline" onClick={() => router.push("/clients")}>
          {t("clients.detail.retour_liste")}
        </Button>
      </div>
    );
  }

  const fiche = client.solvabilite ?? null;
  const prive = client.type_client === "PRIVE";
  const soa = estSoa(client.type_client);

  async function basculerBlocage() {
    if (!fiche) return;
    try {
      await solvCrud.update.mutateAsync({
        id: fiche.id_solvabilite,
        body: { statut_blocage: fiche.statut_blocage ? 0 : 1 },
      });
    } catch {
      /* erreur affichée en notification */
    }
    setConfirmBlocage(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/clients" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {t("clients.detail.fil")}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">{client.nom_client}</h1>
            <TypeBadge type={client.type_client} />
          </div>
          {peutGerer(can, client.type_client, "update") && (
            <Button variant="outline" onClick={() => setModifier(true)}>
              <Pencil className="mr-2 h-4 w-4" /> {t("clients.detail.modifier")}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">{t("clients.detail.identite")}</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {client.code_soa && <Info label={t("clients.detail.code_soa")}>{client.code_soa}</Info>}
            <Info label={client.type_client === "SIMPLE" ? t("clients.detail.cin") : t("clients.detail.nif")}>{client.cin_ou_nif}</Info>
            <Info label={t("clients.detail.telephone")}>{client.telephone}</Info>
            {client.nom_organisme && <Info label={t("clients.detail.organisme")}>{client.nom_organisme}</Info>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{t("clients.detail.localisation")}</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {soa ? (
              <>
                <Info label={t("clients.detail.fokontany")}>{client.nom_fokontany}</Info>
                <Info label={t("clients.detail.commune")}>{client.nom_commune}</Info>
                <Info label={t("clients.detail.district")}>{client.nom_district}</Info>
                <Info label={t("clients.detail.region")}>{client.nom_region}</Info>
                {client.adresse && (
                  <div className="sm:col-span-2">
                    <Info label={t("clients.detail.precisions")}>{client.adresse}</Info>
                  </div>
                )}
              </>
            ) : (
              <Info label={t("clients.detail.ville")}>{client.ville}</Info>
            )}
          </CardContent>
        </Card>

        {prive && can("solvabilite.view") && (
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">{t("clients.detail.solvabilite")}</CardTitle>
              {fiche && can("solvabilite.update") && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSolvOuvert(true)}>
                    <Pencil className="mr-2 h-4 w-4" /> {t("clients.detail.modifier")}
                  </Button>
                  <Button
                    variant={fiche.statut_blocage ? "default" : "destructive"}
                    size="sm"
                    onClick={() => setConfirmBlocage(true)}
                  >
                    {fiche.statut_blocage ? <LockOpen className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}
                    {fiche.statut_blocage ? t("clients.detail.debloquer") : t("clients.detail.bloquer")}
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {fiche ? (
                <div className="grid gap-4 sm:grid-cols-3">
                  <Info label={t("clients.detail.score")}>{t("clients.detail.score_valeur", { v: formatNombre(fiche.score_credit) })}</Info>
                  <Info label={t("clients.detail.plafond")}>{formatAr(fiche.plafond_encours)}</Info>
                  <Info label={t("clients.detail.statut")}>
                    {fiche.statut_blocage ? (
                      <Badge
                        variant="destructive"
                        title={fiche.blocage_auto ? t("clients.detail.bloque_auto_hint") : t("clients.detail.bloque_manuel_hint")}
                      >
                        {t("clients.detail.bloque", { auto: fiche.blocage_auto ? t("clients.detail.bloque_auto") : "" })}
                      </Badge>
                    ) : <Badge variant="secondary">{t("clients.detail.actif")}</Badge>}
                  </Info>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    {t("clients.detail.sans_fiche")}
                  </p>
                  {can("solvabilite.create") && (
                    <Button size="sm" onClick={() => setSolvOuvert(true)}>
                      <Plus className="mr-2 h-4 w-4" /> {t("clients.detail.creer_fiche")}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <ClientFormDialog open={modifier} onOpenChange={setModifier} client={client} />

      <SolvabiliteDialog
        open={solvOuvert}
        onOpenChange={setSolvOuvert}
        clientId={client.id_client}
        clientNom={client.nom_client}
        fiche={fiche}
      />

      <ConfirmDialog
        open={confirmBlocage}
        onOpenChange={setConfirmBlocage}
        title={fiche?.statut_blocage ? t("clients.detail.debloquer_titre") : t("clients.detail.bloquer_titre")}
        description={
          fiche?.statut_blocage
            ? t("clients.detail.debloquer_desc")
            : t("clients.detail.bloquer_desc")
        }
        confirmLabel={fiche?.statut_blocage ? t("clients.detail.debloquer") : t("clients.detail.bloquer")}
        destructive={!fiche?.statut_blocage}
        loading={solvCrud.update.isPending}
        onConfirm={basculerBlocage}
      />
    </div>
  );
}