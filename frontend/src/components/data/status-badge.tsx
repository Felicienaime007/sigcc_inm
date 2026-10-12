import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/contexte";

type Ton = "succes" | "attention" | "danger" | "info" | "neutre";

const STYLES: Record<Ton, { badge: string; dot: string }> = {
  succes: { badge: "bg-green-500/10 text-green-700 ring-green-600/20 dark:bg-green-500/15 dark:text-green-400 dark:ring-green-400/20", dot: "bg-green-500" },
  attention: { badge: "bg-amber-500/10 text-amber-800 ring-amber-600/25 dark:bg-amber-500/15 dark:text-amber-400 dark:ring-amber-400/25", dot: "bg-amber-500" },
  danger: { badge: "bg-red-500/10 text-red-700 ring-red-600/20 dark:bg-red-500/15 dark:text-red-400 dark:ring-red-400/25", dot: "bg-red-500" },
  info: { badge: "bg-blue-500/10 text-blue-700 ring-blue-600/20 dark:bg-blue-500/15 dark:text-blue-400 dark:ring-blue-400/25", dot: "bg-blue-500" },
  neutre: { badge: "bg-muted text-muted-foreground ring-border", dot: "bg-muted-foreground/50" },
};

const TONS: Record<string, Ton> = {
  ACTIF: "succes", INACTIF: "neutre", SUSPENDU: "attention",
  BROUILLON: "neutre", VALIDEE: "info", EN_PREPARATION: "attention",
  LIVREE: "succes", FACTUREE: "succes", ANNULEE: "danger",
  VISE: "info", SOLDE: "succes", ANNULE: "danger",
  PLANIFIE: "neutre", EN_COURS: "attention", TERMINE: "succes", PRETE: "info",
  NON_PAYEE: "danger", PARTIELLE: "attention", PAYEE: "succes",
  EPUISE: "neutre", REGLE: "succes", CONTENTIEUX: "danger",
  A_REMBOURSER: "attention", REMBOURSE: "succes",
  VALIDE: "succes", PREPAREE: "attention", REMISE: "succes",
  EMISE: "succes",
};

const LIBELLES: Record<string, string> = {
  ACTIF: "Actif", INACTIF: "Inactif", SUSPENDU: "Suspendu",
  BROUILLON: "Brouillon", VALIDEE: "Validée", EN_PREPARATION: "En préparation",
  LIVREE: "Livrée", FACTUREE: "Facturée", ANNULEE: "Annulée",
  VISE: "Visé", SOLDE: "Soldé", ANNULE: "Annulé",
  PLANIFIE: "Planifié", EN_COURS: "En cours", TERMINE: "Terminé", PRETE: "Prête",
  NON_PAYEE: "Non payée", PARTIELLE: "Partiellement payée", PAYEE: "Payée",
  EPUISE: "Épuisé", REGLE: "Réglé", CONTENTIEUX: "Contentieux",
  A_REMBOURSER: "À rembourser", REMBOURSE: "Remboursé",
  VALIDE: "Validé", PREPAREE: "Préparée", REMISE: "Remise",
  EMISE: "Émise",
};

function libelle(statut: string, t: (c: string) => string) {
  if (LIBELLES[statut]) return t(`statuts.${statut}`);
  const texte = statut.replaceAll("_", " ").toLowerCase();
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

export function StatusBadge({ statut, className }: { statut: string; className?: string }) {
  const { t } = useT();
  const style = STYLES[TONS[statut] ?? "neutre"];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        style.badge,
        className,
      )}
    >
      <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", style.dot)} />
      {libelle(statut, t)}
    </span>
  );
}