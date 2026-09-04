"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  FolderKanban,
  LayoutDashboard,
  MoreHorizontal,
  User as UserIcon,
} from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { BottomNav } from "@/components/layout/BottomNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar, type Crumb } from "@/components/layout/Topbar";
import { CompanyFormModal } from "@/components/companies/CompanyFormModal";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { ProjectFormModal } from "@/components/projects/ProjectFormModal";
import { useLiveChanges } from "@/hooks/useLiveChanges";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import type { SessionUser } from "@/lib/auth/session";
import type { CompanySummary } from "@/server/services/companies";
import type { ProjectSummary } from "@/server/services/projects";

export interface AppShellProps {
  user: SessionUser;
  companies: CompanySummary[];
  projects: ProjectSummary[];
  children: React.ReactNode;
}

/**
 * Deriva a empresa ativa da própria URL; nas telas sem empresa (dashboard,
 * perfil) cai para a última visitada, guardada no navegador.
 */
function resolveActiveCompany(
  pathname: string,
  companies: CompanySummary[],
  projects: ProjectSummary[],
  remembered: string | null,
): CompanySummary | null {
  if (companies.length === 0) return null;

  const companyMatch = pathname.match(/^\/empresas\/([^/]+)/);
  if (companyMatch) {
    const found = companies.find((company) => company.slug === companyMatch[1]);
    if (found) return found;
  }

  const projectMatch = pathname.match(/^\/projetos\/([^/]+)/);
  if (projectMatch) {
    const project = projects.find((item) => item.id === projectMatch[1]);
    const found = project && companies.find((company) => company.id === project.companyId);
    if (found) return found;
  }

  const rememberedCompany = companies.find((company) => company.slug === remembered);
  return rememberedCompany ?? companies[0];
}

export function AppShell({ user, companies, projects, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useLocalStorage("organizai:sidebar-collapsed", false);
  const [lastCompany, setLastCompany] = useLocalStorage<string | null>(
    "organizai:last-company",
    null,
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [companyModal, setCompanyModal] = useState(false);
  const [projectModal, setProjectModal] = useState(false);

  useLockBodyScroll(drawerOpen);

  const activeCompany = useMemo(
    () => resolveActiveCompany(pathname, companies, projects, lastCompany),
    [pathname, companies, projects, lastCompany],
  );

  // Memoriza a empresa que o usuário está de fato navegando.
  useEffect(() => {
    const inCompanyContext = /^\/(empresas|projetos)\//.test(pathname);
    if (inCompanyContext && activeCompany && activeCompany.slug !== lastCompany) {
      setLastCompany(activeCompany.slug);
    }
  }, [pathname, activeCompany, lastCompany, setLastCompany]);

  // Fecha o drawer ao trocar de rota no mobile.
  useEffect(() => setDrawerOpen(false), [pathname]);

  /**
   * Mantém sidebar, listas e dashboard em dia quando outra pessoa cria ou
   * altera algo.
   *
   * Dentro de um projeto, quem recarrega é o BoardProvider — que rebusca só
   * aquele quadro. Aqui tratamos o resto, com `router.refresh()`, que atualiza
   * os componentes de servidor sem perder o estado local da tela (modal aberto,
   * texto digitado, posição da rolagem).
   */
  const isOnBoardOf = useCallback(
    (projectId?: string) => Boolean(projectId) && pathname === `/projetos/${projectId}`,
    [pathname],
  );

  useLiveChanges(
    useCallback(
      (event) => {
        // Mudança de tarefa/coluna do quadro aberto já é tratada lá dentro.
        if (isOnBoardOf(event.projectId) && event.type !== "project.deleted") return;
        router.refresh();
      },
      [isOnBoardOf, router],
    ),
  );

  const crumbs = useMemo<Crumb[]>(() => {
    const base: Crumb[] = [{ label: "Organizaí", href: "/dashboard" }];

    if (pathname === "/dashboard") return [...base, { label: "Dashboard" }];
    if (pathname === "/perfil") return [...base, { label: "Perfil" }];
    if (pathname === "/empresas") return [...base, { label: "Empresas" }];

    const projectMatch = pathname.match(/^\/projetos\/([^/]+)/);
    if (projectMatch) {
      const project = projects.find((item) => item.id === projectMatch[1]);
      if (project) {
        return [
          ...base,
          { label: project.companyName, href: `/empresas/${project.companySlug}` },
          { label: project.name, color: project.color },
        ];
      }
      return [...base, { label: "Projeto" }];
    }

    const companyMatch = pathname.match(/^\/empresas\/([^/]+)(\/.*)?$/);
    if (companyMatch) {
      const company = companies.find((item) => item.slug === companyMatch[1]);
      const crumbs: Crumb[] = [
        ...base,
        { label: "Empresas", href: "/empresas" },
        {
          label: company?.name ?? companyMatch[1],
          color: company?.color,
          href: `/empresas/${companyMatch[1]}`,
        },
      ];
      if (companyMatch[2]?.startsWith("/configuracoes")) {
        crumbs.push({ label: "Configurações" });
      }
      return crumbs;
    }

    return base;
  }, [pathname, companies, projects]);

  const openCreateProject = useCallback(() => {
    if (!activeCompany) {
      setCompanyModal(true);
      return;
    }
    setProjectModal(true);
  }, [activeCompany]);

  const sidebarProps = {
    user,
    companies,
    projects,
    activeCompany,
    onCreateCompany: () => setCompanyModal(true),
    onCreateProject: openCreateProject,
  };

  return (
    <div className="flex min-h-dvh bg-surface-muted">
      {/* Sidebar desktop */}
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 border-r border-line transition-[width] duration-200 lg:block",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <Sidebar
          {...sidebarProps}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(!collapsed)}
        />
      </aside>

      {/* Drawer mobile */}
      {drawerOpen && (
        <div className="fixed inset-0 z-90 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/25 backdrop-blur-[2px] animate-fade-in"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 w-[272px] border-r border-line shadow-pop animate-slide-left">
            <Sidebar
              {...sidebarProps}
              collapsed={false}
              onToggleCollapse={() => setDrawerOpen(false)}
              onNavigate={() => setDrawerOpen(false)}
            />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar crumbs={crumbs} right={<NotificationBell />} />
        {/* No celular a barra inferior é fixa e cobriria o fim do conteúdo:
            56px da barra + a faixa do indicador de início do iPhone. */}
        <main className="min-w-0 flex-1 pb-[calc(3.5rem+env(safe-area-inset-bottom))] lg:pb-0">
          {children}
        </main>
      </div>

      <BottomNav
        items={[
          {
            label: "Início",
            icon: <LayoutDashboard />,
            href: "/dashboard",
            active: pathname === "/dashboard",
          },
          {
            label: "Empresas",
            icon: <Building2 />,
            href: "/empresas",
            active: pathname === "/empresas",
          },
          {
            label: "Projetos",
            icon: <FolderKanban />,
            // Sem empresa ativa não há projeto que faça sentido abrir; a lista
            // de empresas é o passo anterior natural.
            href: activeCompany ? `/empresas/${activeCompany.slug}` : "/empresas",
            active: pathname.startsWith("/projetos") || /^\/empresas\/[^/]+$/.test(pathname),
          },
          {
            label: "Perfil",
            icon: <UserIcon />,
            href: "/perfil",
            active: pathname === "/perfil",
          },
          {
            label: "Mais",
            icon: <MoreHorizontal />,
            onClick: () => setDrawerOpen(true),
            active: drawerOpen,
          },
        ]}
      />

      <CompanyFormModal open={companyModal} onClose={() => setCompanyModal(false)} />
      {activeCompany && (
        <ProjectFormModal
          open={projectModal}
          onClose={() => setProjectModal(false)}
          companyId={activeCompany.id}
        />
      )}
    </div>
  );
}
