import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
}

/**
 * État vide soigné, style SaaS : icône dans un médaillon,
 * titre resserré, description lisible, action facultative.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "px-4 py-8" : "px-6 py-12",
        className,
      )}
    >
      <span
        aria-hidden
        className="flex h-11 w-11 items-center justify-center rounded-2xl border bg-muted/60 text-muted-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.6)] dark:shadow-none"
      >
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <p className="mt-3 max-w-sm text-sm font-semibold tracking-tight text-foreground">
        {title}
      </p>
      {description && (
        <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-4 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  );
}
