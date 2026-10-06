import { cn } from "@/lib/utils";

type Ton = "succes" | "attention" | "danger" | "info" | "neutre";

const STYLES: Record<Ton, string> = {
  succes: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  attention: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  danger: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  neutre: "bg-muted text-muted-foreground",
};

const TONS: Record<string, Ton> = {
  ACTIF: "succes", INACTIF: "neutre", SUSPENDU: "attention",
  BROUILLON: "neutre", VALIDEE: "info", EN_PREPARATION: "attention",
  LIVREE: "succes", FACTUREE: "succes", ANNULEE: "danger",
  VISE: "info", SOLDE: "succes", ANNULE: "danger",
  PLANIFIE: "neutre", EN_COURS: "attention", TERMINE: "succes", PRETE: "info",
  NON_PAYEE: "danger", PARTIELLE: "attention", PAYEE: "succes",
  EPUISE: "neutre", REGLE: "succes", CONTENTIEUX: "danger",
};

const LIBELLES: Record<string, string> = {
  ACTIF: "Actif", INACTIF: "Inactif", SUSPENDU: "Suspendu",
  BROUILLON: "Brouillon", VALIDEE: "Validée", EN_PREPARATION: "En préparation",
  LIVREE: "Livrée", FACTUREE: "Facturée", ANNULEE: "Annulée",
  VISE: "Visé", SOLDE: "Soldé", ANNULE: "Annulé",
  PLANIFIE: "Planifié", EN_COURS: "En cours", TERMINE: "Terminé", PRETE: "Prête",
  NON_PAYEE: "Non payée", PARTIELLE: "Partiellement payée", PAYEE: "Payée",
  EPUISE: "Épuisé", REGLE: "Réglé", CONTENTIEUX: "Contentieux",
};

function libelle(statut: string) {
  if (LIBELLES[statut]) return LIBELLES[statut];
  const texte = statut.replaceAll("_", " ").toLowerCase();
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

export function StatusBadge({ statut, className }: { statut: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        STYLES[TONS[statut] ?? "neutre"],
        className,
      )}
    >
      {libelle(statut)}
    </span>
  );
}