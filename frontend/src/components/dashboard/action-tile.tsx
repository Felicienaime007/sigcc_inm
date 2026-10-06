"use client";

import Link from "next/link";
import { estPrete } from "@/config/routes";
import { cn } from "@/lib/utils";
import type { ActionDef } from "./types";

export function ActionTile({ action }: { action: ActionDef }) {
  const { label, description, href, icon: Icon } = action;
  const prete = estPrete(href);

  const contenu = (
    <div
      className={cn(
        "flex h-full items-start gap-3 rounded-lg border p-4 transition-colors",
        prete ? "hover:bg-muted/50" : "cursor-not-allowed opacity-60",
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-sm font-medium">
          {label}
          {!prete && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal">Bientôt</span>}
        </p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );

  return prete ? <Link href={href} className="block">{contenu}</Link> : contenu;
}