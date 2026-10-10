import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Petit surtitre (ex. module, fil d'Ariane court). */
  eyebrow?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * En-tête de page SaaS : surtitre discret, titre resserré,
 * description courte, actions alignées à droite.
 * Empile proprement sur mobile et tablette.
 */
export function PageHeader({ title, description, eyebrow, action, className }: PageHeaderProps) {
  return (
    <div className={cn("mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3", className)}>
      <div className="min-w-0 max-w-3xl">
        {eyebrow && (
          <p className="mb-1 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="text-xl font-bold tracking-tight text-balance sm:text-2xl">{title}</h1>
        {description && (
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

export function SectionHeading({
  title,
  action,
  accent = "bg-primary",
}: {
  title: string;
  action?: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <span aria-hidden className={cn("h-4 w-1 rounded-full", accent)} />
      <h2 className="text-xs font-bold tracking-[0.06em] text-foreground uppercase">{title}</h2>
      {action && <div className="ml-auto flex items-center gap-2">{action}</div>}
    </div>
  );
}
