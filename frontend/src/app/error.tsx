"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/contexte";

export default function Erreur({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useT();
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <TriangleAlert className="h-12 w-12 text-destructive" aria-hidden />
      <h1 className="text-2xl font-semibold">{t("commun.erreur_titre")}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        {t("commun.erreur_desc")}
      </p>
      <div className="flex gap-2">
        <Button onClick={() => reset()}>{t("commun.reessayer")}</Button>
        <Button variant="outline" onClick={() => (window.location.href = "/")}>
          {t("shell.tableau_de_bord")}
        </Button>
      </div>
    </div>
  );
}
