"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";
import { Tooltip } from "@/components/ui/Tooltip";

export interface NavItemProps {
  href: string;
  icon: ReactNode;
  label: string;
  active: boolean;
  collapsed: boolean;
  /** Bolinha colorida no lugar do ícone — usada pelos projetos. */
  accent?: string;
  onNavigate?: () => void;
}

/**
 * Item de menu da sidebar. Compartilhado entre a navegação do app e a da
 * administração para que as duas sejam idênticas por construção, e não por
 * coincidência de estilos copiados.
 */
export function NavItem({
  href,
  icon,
  label,
  active,
  collapsed,
  accent,
  onNavigate,
}: NavItemProps) {
  const link = (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-md text-[13.5px] font-medium transition-colors",
        collapsed ? "h-9 justify-center px-0" : "h-9 px-2.5",
        active
          ? "bg-brand-50 text-brand-700"
          : "text-ink-soft hover:bg-surface-sunken hover:text-ink",
        "[&>svg]:size-4 [&>svg]:shrink-0",
      )}
    >
      {accent ? (
        <span
          aria-hidden="true"
          style={{ backgroundColor: accent }}
          className="size-2 shrink-0 rounded-full"
        />
      ) : (
        icon
      )}
      {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
    </Link>
  );

  return collapsed ? <Tooltip content={label}>{link}</Tooltip> : link;
}
