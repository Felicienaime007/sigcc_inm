"use client";

import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useT } from "@/lib/i18n/contexte";

export default function PasTrouve() {
  const { t } = useT();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <FileQuestion className="h-12 w-12 text-muted-foreground" aria-hidden />
      <h1 className="text-2xl font-semibold">{t("commun.page_introuvable")}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        {t("commun.page_introuvable_desc")}
      </p>
      <Link href="/" className={buttonVariants()}>
        {t("commun.retour_accueil")}
      </Link>
    </div>
  );
}
