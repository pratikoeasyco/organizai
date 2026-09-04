"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  ChevronLeft,
  LayoutDashboard,
  LogOut,
  Plus,
  Settings,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { Logo, LogoMark } from "@/components/brand/Logo";
import { Avatar } from "@/components/ui/Avatar";
import { NavItem } from "@/components/layout/NavItem";
import { CompanySwitcher } from "@/components/layout/CompanySwitcher";
import { logoutAction } from "@/server/actions/auth";
import type { SessionUser } from "@/lib/auth/session";
import type { CompanySummary } from "@/server/services/companies";
import type { ProjectSummary } from "@/server/services/projects";

export interface SidebarProps {
  user: SessionUser;
  companies: CompanySummary[];
  projects: ProjectSummary[];
  activeCompany: CompanySummary | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onCreateCompany: () => void;
  onCreateProject: () => void;
  onNavigate?: () => void;
}

export function Sidebar({
  user,
  companies,
  projects,
  activeCompany,
  collapsed,
  onToggleCollapse,
  onCreateCompany,
  onCreateProject,
  onNavigate,
}: SidebarProps) {
  const pathname = usePathname();
  const companyProjects = activeCompany
    ? projects.filter((project) => project.companyId === activeCompany.id)
    : [];

  return (
    <div className="flex h-full flex-col bg-surface">
      {/* Marca — centralizada na largura total da sidebar. O botão de recolher
          fica absoluto para não deslocar o centro da logo. */}
      <div
        className={cn(
          "relative flex h-14 items-center justify-center border-b border-line",
          // px-10 deixa 176px úteis na sidebar de 256px — espaço suficiente
          // para a logo em h-8 (167px) sem encostar no botão de recolher.
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

        <CompanySwitcher
          companies={companies}
          active={activeCompany}
          collapsed={collapsed}
          onCreateCompany={onCreateCompany}
        />

        <nav className="mt-4 space-y-0.5" aria-label="Navegação principal">
          <NavItem
            href="/dashboard"
            icon={<LayoutDashboard />}
            label="Dashboard"
            active={pathname === "/dashboard"}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
          <NavItem
            href="/empresas"
            icon={<Building2 />}
            label="Empresas"
            active={pathname.startsWith("/empresas")}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        </nav>

        {activeCompany && (
          <div className="mt-5">
            {!collapsed && (
              <div className="mb-1.5 flex items-center justify-between px-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                  Projetos
                </p>
                <button
                  type="button"
                  onClick={onCreateProject}
                  aria-label="Novo projeto"
                  className="rounded-sm p-1 text-ink-faint transition-colors hover:bg-surface-sunken hover:text-brand-600"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
            )}

            <div className="space-y-0.5">
              {companyProjects.map((project) => (
                <NavItem
                  key={project.id}
                  href={`/projetos/${project.id}`}
                  icon={null}
                  accent={project.color}
                  label={project.name}
                  active={pathname === `/projetos/${project.id}`}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              ))}

              {companyProjects.length === 0 && !collapsed && (
                <p className="px-2.5 py-1.5 text-[12.5px] leading-relaxed text-ink-faint">
                  Nenhum projeto ainda.
                </p>
              )}

              {!collapsed && (
                <button
                  type="button"
                  onClick={onCreateProject}
                  className="flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-[13.5px] font-medium text-ink-muted transition-colors hover:bg-surface-sunken hover:text-brand-600"
                >
                  <Plus className="size-4 shrink-0" />
                  Novo projeto
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Rodapé */}
      <div className="border-t border-line p-3">
        <nav className="space-y-0.5" aria-label="Conta">
          {/* Esconder o link é conveniência, não segurança: /admin verifica o
              acesso no servidor e devolve 404 para quem não é administrador. */}
          {user.isPlatformAdmin && (
            <NavItem
              href="/admin"
              icon={<ShieldCheck />}
              label="Administração"
              active={pathname.startsWith("/admin")}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          )}
          {activeCompany && (
            <NavItem
              href={`/empresas/${activeCompany.slug}/configuracoes`}
              icon={<Settings />}
              label="Configurações"
              active={pathname.endsWith("/configuracoes")}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          )}
          <NavItem
            href="/perfil"
            icon={<UserIcon />}
            label="Perfil"
            active={pathname === "/perfil"}
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
