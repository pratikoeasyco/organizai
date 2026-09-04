import { Building2, CalendarClock, FolderKanban, ListChecks } from "lucide-react";

import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { AdminCompaniesView } from "@/components/admin/AdminCompaniesView";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { getCompanyStats, listCompaniesForAdmin } from "@/server/services/admin";
import { pluralize } from "@/lib/utils/format";

export const metadata = { title: "Empresas" };

export default async function AdminCompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requirePlatformAdmin();
  const { q } = await searchParams;

  const [companies, stats] = await Promise.all([
    listCompaniesForAdmin(q),
    getCompanyStats(),
  ]);

  return (
    <PageContainer>
      <PageHeader
        title="Empresas"
        description="Todas as empresas da plataforma e seus projetos."
      />

      <section className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Empresas ativas"
          value={stats.active}
          icon={<Building2 />}
          tone="brand"
          hint={
            stats.archived > 0
              ? `${pluralize(stats.archived, "arquivada", "arquivadas")}`
              : "Nenhuma arquivada"
          }
        />
        <StatCard
          label="Projetos ativos"
          value={stats.projects}
          icon={<FolderKanban />}
          hint={
            stats.emptyCompanies > 0
              ? `${stats.emptyCompanies} empresa(s) sem projeto`
              : "Todas as empresas com projeto"
          }
        />
        <StatCard label="Tarefas" value={stats.tasks} icon={<ListChecks />} />
        <StatCard
          label="Compromissos"
          value={stats.events}
          icon={<CalendarClock />}
          tone="positive"
          hint="No calendário"
        />
      </section>

      <AdminCompaniesView companies={companies} initialQuery={q ?? ""} />
    </PageContainer>
  );
}
