import "server-only";

import { prisma } from "@/lib/db";
import { AppError, notFound } from "@/lib/errors";

/**
 * Serviços do painel da plataforma. Toda função aqui presume que o chamador já
 * passou por `requirePlatformAdmin` — as actions e páginas fazem isso.
 */

// ---------------------------------------------------------------------------
// Visão geral
// ---------------------------------------------------------------------------

export interface AdminOverview {
  users: number;
  admins: number;
  companies: number;
  projects: number;
  tasks: number;
  events: number;
  activeSessions: number;
  signupsLast7Days: number;
}

export async function getOverview(): Promise<AdminOverview> {
  const weekAgo = new Date(Date.now() - 7 * 86400000);

  const [users, admins, companies, projects, tasks, events, activeSessions, signups] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isPlatformAdmin: true } }),
      prisma.company.count({ where: { archivedAt: null } }),
      prisma.project.count({ where: { archivedAt: null } }),
      prisma.task.count({ where: { kind: "TASK", archivedAt: null } }),
      prisma.task.count({ where: { kind: "EVENT", archivedAt: null } }),
      prisma.session.count({ where: { expiresAt: { gt: new Date() } } }),
      prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    ]);

  return { users, admins, companies, projects, tasks, events, activeSessions, signupsLast7Days: signups };
}

// ---------------------------------------------------------------------------
// Usuários
// ---------------------------------------------------------------------------

export interface AdminUserStats {
  total: number;
  admins: number;
  withOpenSession: number;
  newLast7Days: number;
  withoutCompany: number;
}

export async function getUserStats(): Promise<AdminUserStats> {
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const now = new Date();

  const [total, admins, withOpenSession, newLast7Days, withoutCompany] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isPlatformAdmin: true } }),
    // Conta pessoas, não sessões: quem tem 3 abas abertas conta uma vez.
    prisma.user.count({ where: { sessions: { some: { expiresAt: { gt: now } } } } }),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    // Sinal de funil: cadastrou e nunca entrou em nenhuma empresa.
    prisma.user.count({ where: { memberships: { none: {} } } }),
  ]);

  return { total, admins, withOpenSession, newLast7Days, withoutCompany };
}

export interface AdminCompanyStats {
  active: number;
  archived: number;
  projects: number;
  archivedProjects: number;
  tasks: number;
  events: number;
  emptyCompanies: number;
}

export async function getCompanyStats(): Promise<AdminCompanyStats> {
  const [active, archived, projects, archivedProjects, tasks, events, emptyCompanies] =
    await Promise.all([
      prisma.company.count({ where: { archivedAt: null } }),
      prisma.company.count({ where: { archivedAt: { not: null } } }),
      prisma.project.count({ where: { archivedAt: null } }),
      prisma.project.count({ where: { archivedAt: { not: null } } }),
      prisma.task.count({ where: { kind: "TASK", archivedAt: null } }),
      prisma.task.count({ where: { kind: "EVENT", archivedAt: null } }),
      prisma.company.count({ where: { archivedAt: null, projects: { none: {} } } }),
    ]);

  return { active, archived, projects, archivedProjects, tasks, events, emptyCompanies };
}

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  jobTitle: string | null;
  avatarColor: string;
  isPlatformAdmin: boolean;
  companyCount: number;
  ownedCompanyCount: number;
  activeSessions: number;
  createdAt: string;
}

export async function listUsers(search?: string): Promise<AdminUserRow[]> {
  const term = search?.trim();

  const users = await prisma.user.findMany({
    where: term
      ? {
          // `mode: "insensitive"` é obrigatório no PostgreSQL: sem ele,
          // procurar por "ana" não acha "Ana". No SQLite o LIKE já ignorava
          // maiúsculas, então a falta disto passaria despercebida na migração.
          OR: [
            { name: { contains: term, mode: "insensitive" } },
            { email: { contains: term, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: [{ isPlatformAdmin: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      jobTitle: true,
      avatarColor: true,
      isPlatformAdmin: true,
      createdAt: true,
      _count: {
        select: {
          memberships: true,
          ownedCompanies: true,
          sessions: { where: { expiresAt: { gt: new Date() } } },
        },
      },
    },
  });

  return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    jobTitle: user.jobTitle,
    avatarColor: user.avatarColor,
    isPlatformAdmin: user.isPlatformAdmin,
    companyCount: user._count.memberships,
    ownedCompanyCount: user._count.ownedCompanies,
    activeSessions: user._count.sessions,
    createdAt: user.createdAt.toISOString(),
  }));
}

/**
 * Sempre precisa sobrar pelo menos um administrador. Sem esta trava, é possível
 * remover o último e perder o acesso ao painel para sempre — só um script
 * direto no banco resolveria.
 */
async function assertNotLastAdmin(userId: string): Promise<void> {
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPlatformAdmin: true },
  });
  if (!target?.isPlatformAdmin) return;

  const admins = await prisma.user.count({ where: { isPlatformAdmin: true } });
  if (admins <= 1) {
    throw new AppError(
      "Esta é a única conta administradora. Promova outra antes de remover o acesso desta.",
      409,
    );
  }
}

export async function updateUser(
  input: {
    userId: string;
    name: string;
    email: string;
    jobTitle: string | null;
    avatarColor: string;
  },
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, email: true },
  });
  if (!user) throw notFound();

  if (input.email !== user.email) {
    const taken = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (taken) throw new AppError("Já existe uma conta com este e-mail.", 409);
  }

  await prisma.user.update({
    where: { id: input.userId },
    data: {
      name: input.name,
      email: input.email,
      jobTitle: input.jobTitle,
      avatarColor: input.avatarColor,
    },
  });
}

export async function setPlatformAdmin(
  actorId: string,
  userId: string,
  isAdmin: boolean,
): Promise<void> {
  if (!isAdmin) {
    if (userId === actorId) {
      throw new AppError(
        "Você não pode remover o próprio acesso de administrador.",
        409,
      );
    }
    await assertNotLastAdmin(userId);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) throw notFound();

  await prisma.user.update({
    where: { id: userId },
    data: { isPlatformAdmin: isAdmin },
  });
}

/** Encerra todas as sessões abertas do usuário — força novo login. */
export async function revokeSessions(userId: string): Promise<number> {
  const { count } = await prisma.session.deleteMany({ where: { userId } });
  return count;
}

export async function deleteUser(actorId: string, userId: string): Promise<void> {
  if (userId === actorId) {
    throw new AppError("Você não pode excluir a própria conta pelo painel.", 409);
  }
  await assertNotLastAdmin(userId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, _count: { select: { ownedCompanies: true } } },
  });
  if (!user) throw notFound();

  if (user._count.ownedCompanies > 0) {
    throw new AppError(
      "Esta conta é proprietária de empresas. Excluí-la apagaria todos os projetos e tarefas delas — transfira ou exclua as empresas primeiro.",
      409,
    );
  }

  await prisma.user.delete({ where: { id: userId } });
}

// ---------------------------------------------------------------------------
// Empresas e projetos (somente leitura)
// ---------------------------------------------------------------------------

export interface AdminCompanyRow {
  id: string;
  name: string;
  slug: string;
  color: string;
  logoEmoji: string | null;
  owner: { id: string; name: string; email: string } | null;
  memberCount: number;
  projectCount: number;
  taskCount: number;
  archivedAt: string | null;
  createdAt: string;
  projects: {
    id: string;
    name: string;
    color: string;
    icon: string | null;
    taskCount: number;
    eventCount: number;
    archivedAt: string | null;
    updatedAt: string;
  }[];
}

/**
 * Metadados de todas as empresas. Deliberadamente **não** expõe conteúdo de
 * tarefas: o painel serve para operar a plataforma, não para ler o trabalho
 * alheio. O isolamento entre empresas continua valendo para o próprio admin.
 */
export async function listCompaniesForAdmin(search?: string): Promise<AdminCompanyRow[]> {
  const term = search?.trim();

  const companies = await prisma.company.findMany({
    where: term
      ? {
          // Mesmo motivo do listUsers: busca sem distinguir maiúsculas.
          OR: [
            { name: { contains: term, mode: "insensitive" } },
            { slug: { contains: term, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      color: true,
      logoEmoji: true,
      archivedAt: true,
      createdAt: true,
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { members: true } },
      projects: {
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          color: true,
          icon: true,
          archivedAt: true,
          updatedAt: true,
          _count: {
            select: { tasks: { where: { archivedAt: null } } },
          },
          tasks: { where: { kind: "EVENT", archivedAt: null }, select: { id: true } },
        },
      },
    },
  });

  return companies.map((company) => {
    const projects = company.projects.map((project) => {
      const eventCount = project.tasks.length;
      return {
        id: project.id,
        name: project.name,
        color: project.color,
        icon: project.icon,
        taskCount: project._count.tasks - eventCount,
        eventCount,
        archivedAt: project.archivedAt?.toISOString() ?? null,
        updatedAt: project.updatedAt.toISOString(),
      };
    });

    return {
      id: company.id,
      name: company.name,
      slug: company.slug,
      color: company.color,
      logoEmoji: company.logoEmoji,
      owner: company.owner,
      memberCount: company._count.members,
      projectCount: projects.length,
      taskCount: projects.reduce((sum, p) => sum + p.taskCount + p.eventCount, 0),
      archivedAt: company.archivedAt?.toISOString() ?? null,
      createdAt: company.createdAt.toISOString(),
      projects,
    };
  });
}
