"use client";

import { Check, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LANGUES } from "@/lib/i18n/types";
import { useLangue } from "@/lib/i18n/contexte";

/** Sélecteur FR / EN / MG dans l'en-tête (choix mémorisé dans ce navigateur). */
export function SelecteurLangue() {
  const { langue, changer, t } = useLangue();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs font-semibold"
            title={t("langue.titre")}
          >
            <Languages className="h-4 w-4" />
            {LANGUES.find((l) => l.code === langue)?.court ?? "FR"}
          </Button>
        }
        aria-label={t("langue.choisir")}
      />
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("langue.titre")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {LANGUES.map((l) => (
            <DropdownMenuItem key={l.code} onClick={() => changer(l.code)}>
              <span className="flex-1">{l.label}</span>
              {l.code === langue && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
