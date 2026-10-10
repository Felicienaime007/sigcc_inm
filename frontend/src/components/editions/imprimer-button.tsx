"use client";

import { useState } from "react";
import { Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { imprimer } from "@/lib/editions";
import { useT } from "@/lib/i18n/contexte";

/** `chemin` : "facture/12", "devis/3", "livraison/5", "avoir/2", "reglement/9", "relance/4", "commande/7". */
export function ImprimerButton({
  chemin, libelle, icone = false, variant = "outline",
}: {
  chemin: string;
  libelle?: string;
  icone?: boolean;
  variant?: "outline" | "default" | "secondary";
}) {
  const { t } = useT();
  const [encours, setEncours] = useState(false);
  const texte = libelle ?? t("tresorerie.editions.imprimer");

  async function clic() {
    setEncours(true);
    try {
      await imprimer(chemin, {
        generation: t("tresorerie.editions.generation"),
        document: t("tresorerie.editions.err_document"),
      });
    } finally {
      setEncours(false);
    }
  }

  const symbole = encours ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />;

  if (icone) {
    return (
      <Button variant="ghost" size="icon" title={texte} aria-label={texte} disabled={encours} onClick={clic}>
        {symbole}
      </Button>
    );
  }
  return (
    <Button variant={variant} disabled={encours} onClick={clic}>
      <span className="mr-2">{symbole}</span>
      {texte}
    </Button>
  );
}
