"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { estPrete } from "@/config/routes";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/contexte";
import type { ActionDef } from "./types";

export function ActionTile({ action }: { action: ActionDef }) {
  const { t } = useT();
  const { label, description, href, icon: Icon } = action;
  const prete = estPrete(href);

  const contenu = (
    <div
      className={cn(
        "card-hover group relative h-full overflow-hidden rounded-xl border bg-card p-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]",
        prete
          ? "hover:border-primary/30"
          : "cursor-not-allowed opacity-60",
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-primary to-teal-500 transition-transform duration-200 group-hover:scale-x-100"
      />
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-[13px] font-semibold">
            <span className="truncate">{label}</span>
            {prete ? (
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:translate-x-px group-hover:text-primary group-hover:opacity-100" />
            ) : (
              <span className="ml-1 shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal">{t("nav.bientot")}</span>
            )}
          </p>
          <p className="mt-px line-clamp-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );

  return prete ? <Link href={href} className="block h-full">{contenu}</Link> : contenu;
}
