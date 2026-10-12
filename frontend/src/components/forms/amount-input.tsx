"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const ESPACES = /[\s\u00a0\u202f\u2009']/g;

const formateur = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** « 1 340 000,50 » (espaces, virgule ou point) → 1340000.5. Vide ou invalide → null. */
export function parseMontant(texte: string): number | null {
  const nettoye = texte.replace(ESPACES, "").replace(",", ".").trim();
  if (nettoye === "" || nettoye === "-" || nettoye === ".") return null;
  // Un seul point décimal, chiffres et signe éventuel uniquement.
  if (!/^-?\d*\.?\d*$/.test(nettoye)) return null;
  const n = Number(nettoye);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/** 1340000.5 → « 1 340 000,5 ». null → "". */
export function formatMontant(valeur: number | null | undefined): string {
  if (valeur === null || valeur === undefined || !Number.isFinite(valeur)) return "";
  return formateur.format(valeur);
}

/** L'utilisateur saisit-il encore la partie décimale ? (on ne reformate pas dans ce cas). */
function saisieDecimaleEnCours(texte: string): boolean {
  return /[,.]\d{0,2}$/.test(texte.trim()) || /[,.]$/.test(texte);
}

interface AmountInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "type" | "inputMode"> {
  /** Valeur numérique (Ariary). null = champ vide. */
  value: number | null | undefined;
  /** Valeur numérique en sortie (arrondie à 2 décimales). */
  onChange: (valeur: number | null) => void;
}

/**
 * Montant en ariary : séparateur de milliers à la saisie, aligné à droite,
 * suffixe « Ar ». Accepte la virgule et le point : « 1 340 000,50 » est
 * transmis comme 1340000.50. Hauteur 40 px, anneau de focus 2 px.
 */
export function AmountInput({ value, onChange, className, onBlur, disabled, ...props }: AmountInputProps) {
  const [texte, setTexte] = useState(() => formatMontant(value));
  const [focalise, setFocalise] = useState(false);

  // Valeur externe (réinitialisation du formulaire…) → réaffiche formatée (hors saisie).
  useEffect(() => {
    if (!focalise) setTexte(formatMontant(value));
  }, [value, focalise]);

  function gererSaisie(saisi: string) {
    // Caractères autorisés : chiffres, espaces, virgule, point, signe moins.
    if (/[^0-9\s\u00a0\u202f\u2009,.\-]/.test(saisi)) return;
    const numerique = parseMontant(saisi);
    // Cas vide/effacement : transmet null sans reformatage.
    if (saisi.trim() === "") {
      setTexte("");
      onChange(null);
      return;
    }
    // Décimale en cours de frappe : affiche brut, transmet quand même la valeur.
    if (saisieDecimaleEnCours(saisi)) {
      setTexte(saisi);
      onChange(numerique);
      return;
    }
    if (numerique !== null) {
      setTexte(formateur.format(numerique));
      onChange(numerique);
    } else {
      setTexte(saisi);
    }
  }

  return (
    <span className="relative block">
      <Input
        {...props}
        disabled={disabled}
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        value={texte}
        onChange={(e) => gererSaisie(e.target.value)}
        onFocus={() => setFocalise(true)}
        onBlur={(e) => {
          setFocalise(false);
          setTexte(formatMontant(parseMontant(texte)));
          onBlur?.(e);
        }}
        aria-label={props["aria-label"] ?? "Montant en ariary"}
        className={cn("pr-11 text-right tabular-nums", className)}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[13px] font-semibold text-muted-foreground"
      >
        Ar
      </span>
    </span>
  );
}
