"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  ChevronLeft,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { Logo, LogoMark } from "@/components/brand/Logo";
import { Avatar } from "@/components/ui/Avatar";
import { NavItem } from "@/components/layout/NavItem";
import { logoutAction } from "@/server/actions/auth";
import type { SessionUser } from "@/lib/auth/session";

export interface AdminSidebarProps {
  user: SessionUser;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onNavigate?: () => void;
}

const SECTIONS = [
  { href: "/admin", label: "Visão geral", icon: <LayoutDashboard />, exact: true },
  { href: "/admin/usuarios", label: "Usuários", icon: <Users />, exact: false },
  { href: "/admin/empresas", label: "Empresas", icon: <Building2 />, exact: false },
];

export function AdminSidebar({
  user,
  collapsed,
  onToggleCollapse,
  onNavigate,
}: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-surface">
      {/* Marca */}
      <div
        className={cn(
          "relative flex h-14 items-center justify-center border-b border-line",
          collapsed ? "px-2" : "px-10",
        )}
      >
        <Link
          href="/dashboard"
          onClick={onNavigate}
          aria-label="Ir para o dashboard"
          className="flex min-w-0 max-w-full justify-center rounded-md"
        >
          {collapsed ? <LogoMark className="size-7" /> : <Logo />}
        </Link>
        {!collapsed && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Recolher menu"
            className="absolute right-3 hidden rounded-sm p-1.5 text-ink-faint transition-colors hover:bg-surface-sunken hover:text-ink-soft lg:block"
          >
            <ChevronLeft className="size-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-slim px-3 py-3">
        {collapsed && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Expandir menu"
            className="mx-auto mb-2 block rounded-sm p-1.5 text-ink-faint transition-colors hover:bg-surface-sunken hover:text-ink-soft"
          >
            <ChevronLeft className="size-4 rotate-180" />
          </button>
        )}

        {/* Identifica a área sem quebrar a linguagem visual do produto. */}
        <div
          className={cn(
            "flex items-center gap-2.5 rounded-lg border border-brand-200 bg-brand-50",
            collapsed ? "justify-center p-1.5" : "px-2.5 py-2",
          )}
          title="Área restrita a administradores da plataforma"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand-600 text-white">
            <ShieldCheck className="size-4" />
          </span>
          {!collapsed && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-semibold leading-tight text-brand-800">
                Administração
              </span>
              <span className="block truncate text-[11.5px] leading-tight text-brand-600">
                Acesso restrito
              </span>
            </span>
          )}
        </div>

        <nav className="mt-4 space-y-0.5" aria-label="Seções da administração">
          {SECTIONS.map((section) => (
            <NavItem
              key={section.href}
              href={section.href}
              icon={section.icon}
              label={section.label}
              active={
                section.exact ? pathname === section.href : pathname.startsWith(section.href)
              }
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          ))}
        </nav>
      </div>

      <div className="border-t border-line p-3">
        <nav className="space-y-0.5" aria-label="Conta">
          <NavItem
            href="/dashboard"
            icon={<ArrowLeft />}
            label="Voltar ao app"
            active={false}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        </nav>

        <div
          className={cn(
            "mt-2 flex items-center gap-2.5 rounded-md border border-line bg-surface-muted",
            collapsed ? "justify-center p-1.5" : "p-2",
          )}
        >
          <Avatar name={user.name} color={user.avatarColor} size="md" />
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium leading-tight text-ink">
                  {user.name}
                </p>
                <p className="truncate text-[11.5px] leading-tight text-ink-faint">
                  {user.email}
                </p>
              </div>
              <form action={logoutAction}>
                <button
                  type="submit"
                  aria-label="Sair da conta"
                  title="Sair"
                  className="rounded-sm p-1.5 text-ink-faint transition-colors hover:bg-surface-sunken hover:text-red-600"
                >
                  <LogOut className="size-4" />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
