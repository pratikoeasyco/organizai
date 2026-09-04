import type { Metadata } from "next";
import Link from "next/link";
import { AlarmClock, Building2, CheckCircle2, CircleDot, FolderKanban } from "lucide-react";

import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { CreateEntityButtons } from "@/components/dashboard/CreateEntityButtons";
import { requireUser } from "@/lib/auth/guards";
import { getDashboard } from "@/server/services/dashboard";
import { listCompanies } from "@/server/services/companies";
import { formatDueLabel, getDueStatus, getFirstName, greeting } from "@/lib/utils/format";
import { PRIORITY_META } from "@/types/domain";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const [data, companies] = await Promise.all([
    getDashboard(user.id),
    listCompanies(user.id),
  ]);

  const hasCompanies = companies.length > 0;
  const firstCompany = companies[0] ?? null;

  return (
    <PageContainer>
      <PageHeader
        title={
          <>
            {greeting()}, {getFirstName(user.name)} <span aria-hidden="true">👋</span>
          </>
        }
        description="Veja o que está acontecendo nas suas empresas."
        actions={
          hasCompanies ? (
            <CreateEntityButtons companyId={firstCompany?.id ?? null} />
          ) : undefined
        }
      />

      {!hasCompanies ? (
        <div className="card-surface mt-7">
          <EmptyState
            icon={<Building2 />}
            title="Nenhuma empresa criada"
            description="Crie sua primeira empresa para começar a organizar seus projetos e tarefas."
            action={<CreateEntityButtons companyId={null} primaryOnly />}
          />
        </div>
      ) : (
        <>
          <section className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Empresas"
              value={data.stats.companies}
              icon={<Building2 />}
              tone="brand"
            />
            <StatCard
              label="Projetos ativos"
              value={data.stats.projects}
              icon={<FolderKanban />}
              tone="neutral"
            />
            <StatCard
              label="Tarefas abertas"
              value={data.stats.openTasks}
              icon={<CircleDot />}
              tone={data.stats.overdueTasks > 0 ? "warning" : "neutral"}
              hint={
                data.stats.overdueTasks > 0
                  ? `${data.stats.overdueTasks} em atraso`
                  : `${data.stats.assignedToMe} atribuídas a você`
              }
            />
            <StatCard
              label="Tarefas concluídas"
              value={data.stats.doneTasks}
              icon={<CheckCircle2 />}
              tone="positive"
            />
          </section>

          <section className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-ink">Projetos recentes</h2>
              <Link
                href="/empresas"
                className="rounded-sm text-[13px] font-medium text-brand-600 transition-colors hover:text-brand-700"
              >
                Ver todas as empresas
              </Link>
            </div>

            {data.recentProjects.length === 0 ? (
              <div className="card-surface">
                <EmptyState
                  compact
                  icon={<FolderKanban />}
                  title="Este espaço ainda está vazio"
                  description="Crie seu primeiro projeto para montar um quadro Kanban."
                  action={
                    firstCompany ? (
                      <CreateEntityButtons companyId={firstCompany.id} projectOnly />
                    ) : undefined
                  }
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {data.recentProjects.map((project) => (
                  <ProjectCard key={project.id} project={project} showCompany />
                ))}
              </div>
            )}
          </section>

          <section className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-5">
            <div className="card-surface overflow-hidden lg:col-span-3">
              <div className="border-b border-line px-4 py-3">
                <h2 className="text-[14px] font-semibold text-ink">Atividade recente</h2>
              </div>
              <ActivityFeed entries={data.activity} />
            </div>

            <div className="card-surface overflow-hidden lg:col-span-2">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <h2 className="text-[14px] font-semibold text-ink">Próximos prazos</h2>
                {data.stats.overdueTasks > 0 && (
                  <Badge color="#DC2626" icon={<AlarmClock />}>
                    {data.stats.overdueTasks} em atraso
                  </Badge>
                )}
              </div>

              {data.upcoming.length === 0 ? (
                <EmptyState
                  compact
                  icon={<AlarmClock />}
                  title="Nenhum prazo definido"
                  description="Adicione datas de vencimento nas tarefas para acompanhá-las aqui."
                />
              ) : (
                <ul className="divide-y divide-line">
                  {data.upcoming.map((task) => {
                    const status = getDueStatus(task.dueDate);
                    const priority = PRIORITY_META[task.priority];
                    return (
                      <li key={task.id}>
                        <Link
                          href={`/projetos/${task.projectId}?tarefa=${task.id}`}
                          className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-muted"
                        >
                          <span
                            aria-hidden="true"
                            style={{ backgroundColor: priority.dot }}
                            className="mt-1.5 size-2 shrink-0 rounded-full"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium text-ink">
                              {task.title}
                            </span>
                            <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-ink-faint">
                              <span
                                aria-hidden="true"
                                style={{ backgroundColor: task.projectColor }}
                                className="size-1.5 rounded-full"
                              />
                              <span className="truncate">{task.projectName}</span>
                            </span>
                          </span>
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                              status === "overdue" && "bg-red-50 text-red-700",
                              status === "today" && "bg-amber-50 text-amber-700",
                              (status === "soon" || status === "future") &&
                                "bg-surface-sunken text-ink-muted",
                            )}
                          >
                            {formatDueLabel(task.dueDate)}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        </>
      )}
    </PageContainer>
  );
}
