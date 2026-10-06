"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { getErrorMessage } from "@/lib/errors";

const schema = z.object({
  identifiant: z.string().min(1, "L'identifiant est obligatoire."),
  password: z.string().min(1, "Le mot de passe est obligatoire."),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const [erreur, setErreur] = useState<string | null>(null);

  const {
    register, handleSubmit, formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // Déjà connecté : on va directement au tableau de bord
  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [loading, user, router]);

  async function onSubmit(values: FormValues) {
    setErreur(null);
    try {
      await login(values.identifiant.trim(), values.password);
      router.replace("/");
    } catch (e) {
      setErreur(getErrorMessage(e, "Connexion impossible."));
    }
  }

  // Session en cours de restauration : on évite le flash du formulaire
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">SIGCC</CardTitle>
          <CardDescription>
            Imprimerie Nationale de Madagascar
            <br />
            Gestion du cycle commercial
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="identifiant">Identifiant</Label>
              <Input id="identifiant" autoComplete="username" autoFocus {...register("identifiant")} />
              {errors.identifiant && <p className="text-sm text-destructive">{errors.identifiant.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input id="password" type="password" autoComplete="current-password" {...register("password")} />
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>

            {erreur && (
              <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {erreur}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Se connecter
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}