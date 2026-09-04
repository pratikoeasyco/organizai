"use client";

import Link from "next/link";
import { ChevronRight, Menu } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { LogoMark } from "@/components/brand/Logo";

export interface Crumb {
  label: string;
  href?: string;
  color?: string;
}

export interface TopbarProps {
  crumbs: Crumb[];
  onOpenMenu: () => void;
  right?: React.ReactNode;
}

export function Topbar({ crumbs, onOpenMenu, right }: TopbarProps) {
  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface/85 px-4 backdrop-blur-md sm:px-6">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Abrir menu"
        className="-ml-1 rounded-md p-2 text-ink-soft transition-colors hover:bg-surface-sunken lg:hidden"
      >
        <Menu className="size-5" />
      </button>

      <LogoMark className="size-6 lg:hidden" />

      <nav aria-label="Trilha de navegação" className="min-w-0 flex-1">
        <ol className="flex min-w-0 items-center gap-1">
          {crumbs.map((crumb, index) => {
            const last = index === crumbs.length - 1;
            return (
              <li key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1">
                {index > 0 && (
                  <ChevronRight className="size-3.5 shrink-0 text-ink-faint" aria-hidden="true" />
                )}
                {crumb.color && (
                  <span
                    aria-hidden="true"
                    style={{ backgroundColor: crumb.color }}
                    className="size-2 shrink-0 rounded-full"
                  />
                )}
                {crumb.href && !last ? (
                  <Link
                    href={crumb.href}
                    className="truncate rounded-sm text-[13px] text-ink-muted transition-colors hover:text-ink"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    aria-current={last ? "page" : undefined}
                    className={cn(
                      "truncate text-[13px]",
                      last ? "font-medium text-ink" : "text-ink-muted",
                    )}
                  >
                    {crumb.label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </header>
  );
}
