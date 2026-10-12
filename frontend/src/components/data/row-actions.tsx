"use client";

import { Ellipsis, type LucideIcon } from "lucide-react";
import { IconButton } from "@/components/ui/action-button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuShortcut, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useT } from "@/lib/i18n/contexte";

export interface RowActionItem {
  key: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  danger?: boolean;
  shortcut?: string;
  disabled?: boolean;
  disabledReason?: string;
  /** Masquée (ex. privilège manquant via useAuth().can) : ni visible ni dans le menu. */
  hidden?: boolean;
}

interface RowActionsProps {
  items: RowActionItem[];
  /** Nombre d'actions visibles avant le menu « ⋯ » (1 ou 2). */
  maxVisible?: 1 | 2;
  /** Libellé accessible du menu « ⋯ » (défaut traduit). */
  menuLabel?: string;
}

/**
 * Actions de ligne SaaS : 1 à 2 boutons-icônes visibles (infobulle + aria-label
 * obligatoires) puis menu « ⋯ » avec icônes, dangers et raccourcis.
 * Taille 36 px adaptée aux tableaux denses.
 */
export function RowActions({ items, maxVisible = 2, menuLabel }: RowActionsProps) {
  const { t } = useT();
  const visibles = items.filter((i) => !i.hidden);
  const directes = visibles.slice(0, maxVisible);
  const auMenu = visibles.slice(maxVisible);
  const libelleMenu = menuLabel ?? t("commun.plus_actions");

  return (
    <span className="inline-flex items-center gap-1">
      {directes.map((item) => (
        <IconButton
          key={item.key}
          variant="ghost"
          size="icon-sm"
          tooltip={item.shortcut ? `${item.label} (${item.shortcut})` : item.label}
          aria-label={item.label}
          disabled={item.disabled}
          disabledReason={item.disabledReason}
          onClick={() => item.onSelect()}
          className={item.danger ? "text-destructive hover:bg-destructive/10 hover:text-destructive" : undefined}
        >
          <item.icon aria-hidden />
        </IconButton>
      ))}
      {auMenu.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={(
              <IconButton variant="ghost" size="icon-sm" tooltip={libelleMenu} aria-label={libelleMenu}>
                <Ellipsis aria-hidden />
              </IconButton>
            )}
          />
          <DropdownMenuContent align="end" className="min-w-52">
            {auMenu.map((item) => (
              <DropdownMenuItem
                key={item.key}
                variant={item.danger ? "destructive" : "default"}
                disabled={item.disabled || !!item.disabledReason}
                title={item.disabledReason ?? (item.shortcut ? `${item.label} (${item.shortcut})` : undefined)}
                onClick={() => item.onSelect()}
              >
                <item.icon aria-hidden />
                <span className="flex-1">{item.label}</span>
                {item.shortcut && <DropdownMenuShortcut>{item.shortcut}</DropdownMenuShortcut>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </span>
  );
}
