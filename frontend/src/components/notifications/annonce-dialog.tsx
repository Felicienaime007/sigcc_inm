"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/i18n/contexte";
import { getErrorMessage } from "@/lib/errors";
import { useApiMutation, useOptions } from "@/lib/resource";
import type { Role } from "@/types/users";

/** Envoi d'une annonce à tous les utilisateurs ou à certains rôles. */
export function AnnonceDialog({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const { can } = useAuth();
  const roles = useOptions<Role>("users/roles", {}, can("role.view"));
  const [titre, setTitre] = useState("");
  const [message, setMessage] = useState("");
  const [niveau, setNiveau] = useState("INFO");
  const [lien, setLien] = useState("");
  const [tous, setTous] = useState(true);
  const [choisis, setChoisis] = useState<string[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);

  const envoyer = useApiMutation(
    async (body: unknown) => (await api.post<{ envoyees: number }>("/notifications/annonces/", body)).data,
    { silentError: true },
  );

  async function valider() {
    setErreur(null);
    if (!titre.trim()) return setErreur(t("notif.annonce.err_titre"));
    if (!tous && choisis.length === 0) return setErreur(t("notif.annonce.err_roles"));
    if (lien.trim() && (!lien.startsWith("/") || lien.startsWith("//"))) {
      return setErreur(t("notif.annonce.err_lien"));
    }
    try {
      const r = await envoyer.mutateAsync({
        titre: titre.trim(), message: message.trim(), niveau, tous,
        roles: tous ? [] : choisis, ...(lien.trim() ? { lien: lien.trim() } : {}),
      });
      const { toast } = await import("sonner");
      toast.success(t("notif.annonce.envoyee", { n: r.envoyees }));
      onClose();
    } catch (e) {
      setErreur(getErrorMessage(e));
    }
  }

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t("notif.annonce.titre")}
      description={t("notif.annonce.description")}
      onSubmit={(e) => { e?.preventDefault(); void valider(); }}
      submitting={envoyer.isPending}
      error={erreur}
      submitLabel={t("notif.annonce.envoyer")}
    >
      <Field label={t("notif.annonce.champ_titre")} htmlFor="titre">
        <Input id="titre" maxLength={150} value={titre} onChange={(e) => setTitre(e.target.value)} />
      </Field>
      <Field label={t("notif.annonce.champ_message")} htmlFor="message">
        <Textarea id="message" rows={3} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("notif.annonce.importance")}>
          <Select value={niveau} onValueChange={(v) => setNiveau(v ?? "INFO")} items={{ INFO: "Information", ATTENTION: "Attention", URGENT: "Urgent" }}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="INFO">{t("notif.annonce.info")}</SelectItem>
              <SelectItem value="ATTENTION">{t("notif.annonce.attention")}</SelectItem>
              <SelectItem value="URGENT">{t("notif.annonce.urgent")}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("notif.annonce.lien")} htmlFor="lien" hint={t("notif.annonce.lien_hint")}>
          <Input id="lien" maxLength={200} value={lien} onChange={(e) => setLien(e.target.value)} />
        </Field>
      </div>

      <Field label={t("notif.annonce.destinataires")}>
        <div className="space-y-2 rounded-md border p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Checkbox checked={tous} onCheckedChange={(c) => setTous(c === true)} /> {t("notif.annonce.tous")}
          </label>
          {!tous && (
            <div className="grid grid-cols-2 gap-2 pl-6">
              {(roles.data ?? []).filter((r) => r.libelle_role !== "ADMIN").map((r) => (
                <label key={r.id_role} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={choisis.includes(r.libelle_role)}
                    onCheckedChange={(c) =>
                      setChoisis((s) => (c === true ? [...s, r.libelle_role] : s.filter((x) => x !== r.libelle_role)))
                    }
                  />
                  {r.libelle_role}
                </label>
              ))}
              {(roles.data?.length ?? 0) === 0 && (
                <p className="col-span-2 text-xs text-muted-foreground">{t("notif.annonce.roles_indispo")}</p>
              )}
            </div>
          )}
        </div>
      </Field>
    </FormDialog>
  );
}