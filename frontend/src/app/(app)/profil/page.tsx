"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { AvatarUtilisateur } from "@/components/users/avatar-utilisateur";
import { Field } from "@/components/forms/field";
import { api } from "@/lib/api";
import { compresserImage, enregistrerAvatar, retirerAvatar, useAvatar } from "@/lib/avatar";
import { useAuth } from "@/lib/auth-context";
import { applyServerErrors } from "@/lib/form-utils";

const schema = z
  .object({
    old_password: z.string().min(1, "Saisissez votre mot de passe actuel."),
    new_password: z.string().min(1, "Saisissez le nouveau mot de passe."),
    confirmation: z.string().min(1, "Confirmez le nouveau mot de passe."),
  })
  .refine((d) => d.new_password === d.confirmation, {
    path: ["confirmation"], message: "Les deux mots de passe sont différents.",
  })
  .refine((d) => d.new_password !== d.old_password, {
    path: ["new_password"], message: "Le nouveau mot de passe doit être différent de l'ancien.",
  });
type FormValues = z.infer<typeof schema>;

export default function ProfilPage() {
  const { user } = useAuth();
  const [erreur, setErreur] = useState<string | null>(null);
  const photo = useAvatar(user?.id_utilisateur ?? null);
  const [erreurPhoto, setErreurPhoto] = useState<string | null>(null);
  const [traitementPhoto, setTraitementPhoto] = useState(false);
  const entreeFichier = useRef<HTMLInputElement>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { old_password: "", new_password: "", confirmation: "" },
  });

  const envoyer = form.handleSubmit(async (values) => {
    setErreur(null);
    try {
      await api.post("/auth/change-password/", {
        old_password: values.old_password,
        new_password: values.new_password,
      });
      toast.success("Mot de passe modifié.");
      form.reset();
    } catch (e) {
      setErreur(applyServerErrors(e, form.setError, ["old_password", "new_password"]));
    }
  });

  if (!user) return null;

  const idUtilisateur = user.id_utilisateur;

  async function choisirPhoto(e: ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0];
    e.target.value = ""; // permettre de rechoisir le même fichier
    if (!fichier) return;
    setTraitementPhoto(true);
    setErreurPhoto(null);
    try {
      enregistrerAvatar(idUtilisateur, await compresserImage(fichier));
      toast.success("Photo de profil mise à jour.");
    } catch (err) {
      setErreurPhoto(err instanceof Error ? err.message : "Impossible de lire cette image.");
    } finally {
      setTraitementPhoto(false);
    }
  }

  function retirerPhoto() {
    retirerAvatar(idUtilisateur);
    setErreurPhoto(null);
    toast.success("Photo supprimée : icône par défaut.");
  }

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Mon profil" description="Votre photo, vos informations et votre mot de passe." />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Photo de profil</CardTitle>
          <CardDescription>
            Visible dans le menu et la gestion des utilisateurs. Sans photo, c&apos;est l&apos;icône par défaut qui s&apos;affiche.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <AvatarUtilisateur idUtilisateur={user.id_utilisateur} nom={user.nom_complet} taille="xl" />
            <div className="flex flex-wrap gap-2">
              <input
                ref={entreeFichier}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void choisirPhoto(e)}
              />
              <Button
                type="button"
                variant="outline"
                disabled={traitementPhoto}
                onClick={() => entreeFichier.current?.click()}
              >
                {traitementPhoto && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {!traitementPhoto && <ImagePlus className="mr-2 h-4 w-4" />}
                Changer la photo
              </Button>
              {photo && (
                <Button type="button" variant="ghost" disabled={traitementPhoto} onClick={retirerPhoto}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Retirer
                </Button>
              )}
            </div>
          </div>
          {erreurPhoto && (
            <p role="alert" className="mt-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{erreurPhoto}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informations</CardTitle>
          <CardDescription>Modifiables uniquement par un administrateur.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div><p className="text-muted-foreground">Nom</p><p className="font-medium">{user.nom_complet}</p></div>
          <div><p className="text-muted-foreground">Identifiant</p><p className="font-medium">{user.identifiant}</p></div>
          <div><p className="text-muted-foreground">Matricule</p><p className="font-medium">{user.matricule}</p></div>
          <div>
            <p className="text-muted-foreground">Rôles</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {user.roles.map((r) => <Badge key={r} variant="secondary">{r}</Badge>)}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Changer mon mot de passe</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={envoyer} className="space-y-4" noValidate>
            <Field label="Mot de passe actuel" htmlFor="old_password" error={form.formState.errors.old_password?.message}>
              <Input id="old_password" type="password" autoComplete="current-password" {...form.register("old_password")} />
            </Field>
            <Field
              label="Nouveau mot de passe"
              htmlFor="new_password"
              error={form.formState.errors.new_password?.message}
              hint="8 caractères minimum, ni trop courant ni uniquement numérique."
            >
              <Input id="new_password" type="password" autoComplete="new-password" {...form.register("new_password")} />
            </Field>
            <Field label="Confirmation" htmlFor="confirmation" error={form.formState.errors.confirmation?.message}>
              <Input id="confirmation" type="password" autoComplete="new-password" {...form.register("confirmation")} />
            </Field>

            {erreur && (
              <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{erreur}</p>
            )}

            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Modifier le mot de passe
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}