"use client";

import Link from "next/link";

import { cn } from "@/lib/utils/cn";

export interface BottomNavItem {
  label: string;
  icon: React.ReactNode;
  /** Um item ou navega (`href`) ou executa uma ação (`onClick`), nunca ambos. */
  href?: string;
  onClick?: () => void;
  active: boolean;
}

/**
 * Navegação principal no celular.
 *
 * Substitui o menu lateral por uma barra fixa embaixo, onde o polegar alcança —
 * o padrão que as pessoas já conhecem dos aplicativos que usam todo dia. O menu
 * lateral continua existindo atrás de "Mais", porque troca de empresa, projetos,
 * configurações e sair não cabem em cinco botões.
 *
 * No desktop some: lá a lateral fixa mostra muito mais de uma vez.
 *
 * Os itens vêm de fora porque o app e o painel administrativo navegam por
 * lugares diferentes — o que não muda é a forma.
 */
export function BottomNav({ items }: { items: BottomNavItem[] }) {
  return (
    <nav
      aria-label="Navegação principal"
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface/95 backdrop-blur-md lg:hidden",
        // O iPhone reserva uma faixa embaixo para o indicador de início. Sem
        // isto, os rótulos ficam por baixo dele.
        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <ul className="flex items-stretch">
        {items.map((item) => {
          const conteudo = (
            <span
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl px-3 py-1.5 transition-colors",
                item.active ? "bg-brand-600 text-white" : "text-ink-faint",
              )}
            >
              <span aria-hidden="true" className="[&>svg]:size-5 [&>svg]:shrink-0">
                {item.icon}
              </span>
              <span className="text-[10.5px] font-medium leading-none">{item.label}</span>
            </span>
          );

          return (
            <li key={item.label} className="flex-1">
              {item.href ? (
                <Link
                  href={item.href}
                  aria-current={item.active ? "page" : undefined}
                  className="flex h-full items-center justify-center py-1.5"
                >
                  {conteudo}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={item.onClick}
                  aria-expanded={item.active}
                  className="flex h-full w-full items-center justify-center py-1.5"
                >
                  {conteudo}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
