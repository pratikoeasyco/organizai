import "server-only";

import { prisma } from "@/lib/db";
import {
  notFound,
  requireCompanyAccess,
  requireProjectAccess,
  visibleProjectFilter,
} from "@/lib/auth/guards";
import { logActivity } from "@/server/services/activity";
import { emitChange } from "@/server/events/bus";
import type { Role } from "@/types/domain";

/** Estruturas iniciais oferecidas na criação do projeto. */
export const PROJECT_TEMPLATES = {
  basic: {
    label: "Essencial",
    description: "A fazer · Fazendo · Concluído",
    columns: [
      { name: "A fazer", color: "#94A3B8" },
      { name: "Fazendo", color: "#2563EB" },
      { name: "Concluído", color: "#10B981" },
    ],
  },
  kanban: {
    label: "Fluxo completo",
    description: "Backlog · Planejamento · Em andamento · Em revisão · Concluído",
    columns: [
      { name: "Backlog", color: "#94A3B8" },
      { name: "Planejamento", color: "#6366F1" },
      { name: "Em andamento", color: "#2563EB" },
      { name: "Em revisão", color: "#F59E0B" },
      { name: "Concluído", color: "#10B981" },
    ],
  },
  content: {
    label: "Conteúdo",
    description: "Ideias · Produção · Revisão · Aprovado · Publicado",
    columns: [
      { name: "Ideias", color: "#A855F7" },
      { name: "Produção", color: "#2563EB" },
      { name: "Revisão", color: "#F59E0B" },
      { name: "Aprovado", color: "#14B8A6" },
      { name: "Publicado", color: "#10B981" },
    ],
  },
  empty: {
    label: "Em branco",
    description: "Comece sem nenhuma coluna",
    columns: [] as { name: string; color: string }[],
  },
} as const;

export type ProjectTemplate = keyof typeof PROJECT_TEMPLATES;

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  companyId: string;
  companyName: string;
  companySlug: string;
  companyColor: string;
  taskCount: number;
  doneCount: number;
  columnCount: number;
  archivedAt: string | null;
  updatedAt: string;
  createdAt: string;
}

/**
 * "Concluídas" = tarefas na última coluna do quadro. É a leitura que o usuário
 * espera de um Kanban sem exigir que ele configure um status especial.
 */
function summarize(project: {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  companyId: string;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  company: { name: string; slug: string; color: string };
  columns: { id: string; position: number; _count: { tasks: number } }[];
}): ProjectSummary {
  const taskCount = project.columns.reduce((sum, c) => sum + c._count.tasks, 0);
  const last = project.columns[project.columns.length - 1];
  const doneCount = project.columns.length > 1 ? (last?._count.tasks ?? 0) : 0;

  return {
    id: project.id,
    name: project.name,
    description: project.description,
    color: project.color,
    icon: project.icon,
    companyId: project.companyId,
    companyName: project.company.name,
    companySlug: project.company.slug,
    companyColor: project.company.color,
    taskCount,
    doneCount,
    columnCount: project.columns.length,
    archivedAt: project.archivedAt?.toISOString() ?? null,
    updatedAt: project.updatedAt.toISOString(),
    createdAt: project.createdAt.toISOString(),
  };
}

const summarySelect = {
  id: true,
  name: true,
  description: true,
  color: true,
  icon: true,
  companyId: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  company: { select: { name: true, slug: true, color: true } },
  columns: {
    where: { archivedAt: null },
    orderBy: { position: "asc" },
    select: {
      id: true,
      position: true,
      _count: { select: { tasks: { where: { archivedAt: null } } } },
    },
  },
} as const;

export async function listProjects(
  userId: string,
  companyId: string,
  options: { includeArchived?: boolean } = {},
): Promise<ProjectSummary[]> {
  await requireCompanyAccess(userId, companyId);

  const projects = await prisma.project.findMany({
    where: {
      companyId,
      ...(options.includeArchived ? {} : { archivedAt: null }),
      // Membros e visualizadores só enxergam os projetos em que foram incluídos.
      ...visibleProjectFilter(userId),
    },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: summarySelect,
  });

  return projects.map(summarize);
}

/** Projetos de todas as empresas do usuário — usado na sidebar e no dashboard. */
export async function listAllProjects(userId: string): Promise<ProjectSummary[]> {
  const projects = await prisma.project.findMany({
    where: {
      archivedAt: null,
      company: { archivedAt: null, members: { some: { userId } } },
      ...visibleProjectFilter(userId),
    },
    orderBy: [{ updatedAt: "desc" }],
    select: summarySelect,
  });

  return projects.map(summarize);
}

export async function listRecentProjects(
  userId: string,
  limit = 6,
): Promise<ProjectSummary[]> {
  const recents = await prisma.recentProject.findMany({
    where: {
      userId,
      project: {
        archivedAt: null,
        company: { archivedAt: null },
        ...visibleProjectFilter(userId),
      },
    },
    orderBy: { visitedAt: "desc" },
    take: limit,
    select: { project: { select: summarySelect } },
  });

  if (recents.length > 0) return recents.map((r) => summarize(r.project));

  // Sem histórico ainda: mostra os projetos mais recentes da conta.
  const fallback = await prisma.project.findMany({
    where: {
      archivedAt: null,
      company: { archivedAt: null, members: { some: { userId } } },
      ...visibleProjectFilter(userId),
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: summarySelect,
  });

  return fallback.map(summarize);
}

export async function getProject(
  userId: string,
  projectId: string,
): Promise<ProjectSummary & { role: Role }> {
  const { role } = await requireProjectAccess(userId, projectId);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: summarySelect,
  });
  if (!project) throw notFound();

  return { ...summarize(project), role };
}

export async function touchRecentProject(
  userId: string,
  projectId: string,
): Promise<void> {
  await prisma.recentProject
    .upsert({
      where: { userId_projectId: { userId, projectId } },
      create: { userId, projectId },
      update: { visitedAt: new Date() },
    })
    .catch(() => undefined);
}

interface CreateProjectInput {
  companyId: string;
  name: string;
  description?: string | null;
  color: string;
  icon?: string | null;
  template: ProjectTemplate;
}

export async function createProject(
  userId: string,
  input: CreateProjectInput,
): Promise<ProjectSummary> {
  const access = await requireCompanyAccess(userId, input.companyId, "MEMBER");

  const last = await prisma.project.findFirst({
    where: { companyId: input.companyId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const template = PROJECT_TEMPLATES[input.template] ?? PROJECT_TEMPLATES.basic;

  const project = await prisma.project.create({
    data: {
      companyId: input.companyId,
      name: input.name,
      description: input.description ?? null,
      color: input.color,
      icon: input.icon ?? null,
      position: (last?.position ?? -1) + 1,
      createdById: userId,
      columns: {
        create: template.columns.map((column, index) => ({
          name: column.name,
          color: column.color,
          position: index,
        })),
      },
      // Quem cria precisa continuar enxergando o próprio projeto. Owner e admin
      // da empresa já acessam tudo, então só membros comuns recebem a linha.
      members:
        access.role === "OWNER" || access.role === "ADMIN"
          ? undefined
          : { create: { userId, role: "ADMIN" } },
    },
    select: summarySelect,
  });

  emitChange({ type: "project.created", companyId: input.companyId, projectId: project.id, actorId: userId });
  await logActivity({
    companyId: input.companyId,
    actorId: userId,
    projectId: project.id,
    type: "project.created",
    message: `criou o projeto ${project.name}`,
  });

  return summarize(project);
}

export async function updateProject(
  userId: string,
  input: {
    projectId: string;
    name: string;
    description?: string | null;
    color: string;
    icon?: string | null;
  },
): Promise<void> {
  const { companyId } = await requireProjectAccess(userId, input.projectId, "MEMBER");

  const project = await prisma.project.update({
    where: { id: input.projectId },
    data: {
      name: input.name,
      description: input.description ?? null,
      color: input.color,
      icon: input.icon ?? null,
    },
    select: { id: true, name: true },
  });

  emitChange({ type: "project.updated", companyId, projectId: input.projectId, actorId: userId });
  await logActivity({
    companyId,
    actorId: userId,
    projectId: project.id,
    type: "project.updated",
    message: `atualizou o projeto ${project.name}`,
  });
}

export async function setProjectArchived(
  userId: string,
  projectId: string,
  archived: boolean,
): Promise<void> {
  const { companyId } = await requireProjectAccess(userId, projectId, "ADMIN");

  const project = await prisma.project.update({
    where: { id: projectId },
    data: { archivedAt: archived ? new Date() : null },
    select: { name: true },
  });

  emitChange({ type: "project.updated", companyId, projectId, actorId: userId });
  await logActivity({
    companyId,
    actorId: userId,
    projectId,
    type: "project.archived",
    message: `${archived ? "arquivou" : "restaurou"} o projeto ${project.name}`,
  });
}

export async function deleteProject(userId: string, projectId: string): Promise<void> {
  const { companyId } = await requireProjectAccess(userId, projectId, "ADMIN");
  await prisma.project.delete({ where: { id: projectId } });
  emitChange({ type: "project.deleted", companyId, projectId, actorId: userId });
}
