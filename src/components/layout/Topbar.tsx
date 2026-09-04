"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { LogoMark } from "@/components/brand/Logo";

export interface Crumb {
  label: string;
  href?: string;
  color?: string;
}

export interface TopbarProps {
  crumbs: Crumb[];
  right?: React.ReactNode;
}

export function Topbar({ crumbs, right }: TopbarProps) {
  return (
    // `top-0` + a área segura: em tela cheia no iPhone o topo fica sob o
    // relógio e a bateria se não recuarmos.
    <header className="sticky top-0 z-40 flex h-[calc(3.5rem+env(safe-area-inset-top))] shrink-0 items-center gap-3 border-b border-line bg-surface/85 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-md sm:px-6">
      {/* Sem botão de menu: no celular quem abre o menu completo é o "Mais" da
          barra inferior. Duas portas para a mesma gaveta só confundem. */}
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
