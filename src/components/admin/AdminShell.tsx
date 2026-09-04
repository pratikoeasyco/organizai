"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils/cn";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { Topbar, type Crumb } from "@/components/layout/Topbar";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import type { SessionUser } from "@/lib/auth/session";

const SECTION_LABELS: Record<string, string> = {
  "/admin/usuarios": "Usuários",
  "/admin/empresas": "Empresas",
};

/**
 * Mesma estrutura do AppShell — sidebar recolhível, drawer no mobile e topbar
 * com trilha — para o painel não parecer outro produto. O que muda é só o
 * conteúdo do menu.
 */
export function AdminShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useLocalStorage("organizai:admin-sidebar-collapsed", false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useLockBodyScroll(drawerOpen);
  useEffect(() => setDrawerOpen(false), [pathname]);

  const crumbs = useMemo<Crumb[]>(() => {
    const base: Crumb[] = [
      { label: "Organizaí", href: "/dashboard" },
      { label: "Administração", href: "/admin" },
    ];
    const section = SECTION_LABELS[pathname];
    return section ? [...base, { label: section }] : [...base.slice(0, 1), { label: "Administração" }];
  }, [pathname]);

  return (
    <div className="flex min-h-dvh bg-surface-muted">
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 border-r border-line transition-[width] duration-200 lg:block",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <AdminSidebar
          user={user}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(!collapsed)}
        />
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-90 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/25 backdrop-blur-[2px] animate-fade-in"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 w-[272px] border-r border-line shadow-pop animate-slide-left">
            <AdminSidebar
              user={user}
              collapsed={false}
              onToggleCollapse={() => setDrawerOpen(false)}
              onNavigate={() => setDrawerOpen(false)}
            />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar crumbs={crumbs} onOpenMenu={() => setDrawerOpen(true)} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
