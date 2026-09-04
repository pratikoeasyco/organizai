import "server-only";

import { prisma } from "@/lib/db";
import { visibleProjectFilter } from "@/lib/auth/guards";
import { listRecentProjects, type ProjectSummary } from "@/server/services/projects";
import { listAccountActivity, type ActivityEntry } from "@/server/services/activity";
import type { Priority } from "@/types/domain";

export interface DashboardStats {
  companies: number;
  projects: number;
  openTasks: number;
  doneTasks: number;
  overdueTasks: number;
  assignedToMe: number;
}

export interface UpcomingTask {
  id: string;
  title: string;
  dueDate: string;
  priority: Priority;
  projectId: string;
  projectName: string;
  projectColor: string;
}

export interface DashboardData {
  stats: DashboardStats;
  recentProjects: ProjectSummary[];
  activity: ActivityEntry[];
  upcoming: UpcomingTask[];
}

export async function getDashboard(userId: string): Promise<DashboardData> {
  const memberships = await prisma.companyMember.findMany({
    where: { userId, company: { archivedAt: null } },
    select: { companyId: true },
  });
  const companyIds = memberships.map((m) => m.companyId);

  if (companyIds.length === 0) {
    return {
      stats: {
        companies: 0,
        projects: 0,
        openTasks: 0,
        doneTasks: 0,
        overdueTasks: 0,
        assignedToMe: 0,
      },
      recentProjects: [],
      activity: [],
      upcoming: [],
    };
  }

  // Só conta o que o usuário pode ver: um projeto ao qual ele não tem acesso
  // não pode aparecer nem como número no dashboard.
  const visible = visibleProjectFilter(userId);
  const scope = {
    archivedAt: null,
    project: { archivedAt: null, companyId: { in: companyIds }, ...visible },
  };
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // "Concluída" = tarefa na última coluna do quadro; buscamos essas colunas.
  const projects = await prisma.project.findMany({
    where: { archivedAt: null, companyId: { in: companyIds }, ...visible },
    select: {
      id: true,
      columns: {
        where: { archivedAt: null },
        orderBy: { position: "desc" },
        take: 1,
        select: { id: true },
      },
      _count: { select: { columns: { where: { archivedAt: null } } } },
    },
  });

  const doneColumnIds = projects
    .filter((p) => p._count.columns > 1)
    .map((p) => p.columns[0]?.id)
    .filter((id): id is string => Boolean(id));

  const [projectCount, totalTasks, doneTasks, overdueTasks, assignedToMe, upcomingRaw] =
    await Promise.all([
      prisma.project.count({
        where: { archivedAt: null, companyId: { in: companyIds }, ...visible },
      }),
      prisma.task.count({ where: scope }),
      doneColumnIds.length > 0
        ? prisma.task.count({ where: { ...scope, columnId: { in: doneColumnIds } } })
        : Promise.resolve(0),
      prisma.task.count({
        where: {
          ...scope,
          dueDate: { lt: startOfToday },
          ...(doneColumnIds.length > 0 ? { columnId: { notIn: doneColumnIds } } : {}),
        },
      }),
      prisma.task.count({ where: { ...scope, assigneeId: userId } }),
      prisma.task.findMany({
        where: {
          ...scope,
          dueDate: { not: null },
          ...(doneColumnIds.length > 0 ? { columnId: { notIn: doneColumnIds } } : {}),
        },
        orderBy: { dueDate: "asc" },
        take: 6,
        select: {
          id: true,
          title: true,
          dueDate: true,
          priority: true,
          project: { select: { id: true, name: true, color: true } },
        },
      }),
    ]);

  const [recentProjects, activity] = await Promise.all([
    listRecentProjects(userId, 6),
    listAccountActivity(userId, 10),
  ]);

  return {
    stats: {
      companies: companyIds.length,
      projects: projectCount,
      openTasks: totalTasks - doneTasks,
      doneTasks,
      overdueTasks,
      assignedToMe,
    },
    recentProjects,
    activity,
    upcoming: upcomingRaw.map((task) => ({
      id: task.id,
      title: task.title,
      dueDate: task.dueDate!.toISOString(),
      priority: task.priority as Priority,
      projectId: task.project.id,
      projectName: task.project.name,
      projectColor: task.project.color,
    })),
  };
}
