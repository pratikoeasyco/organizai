import "server-only";

import { prisma } from "@/lib/db";
import { AppError, forbidden, notFound, requireCompanyAccess } from "@/lib/auth/guards";
import { randomSuffix, slugify } from "@/lib/utils/slug";
import { logActivity } from "@/server/services/activity";
import type { Role } from "@/types/domain";

export interface CompanySummary {
  id: string;
  name: string;
  slug: string;
  color: string;
  logoEmoji: string | null;
  role: Role;
  projectCount: number;
  memberCount: number;
  taskCount: number;
  lastActivityAt: string | null;
  createdAt: string;
}

/** Garante unicidade do slug adicionando sufixo curto quando necessário. */
async function resolveSlug(desired: string, fallbackFrom: string): Promise<string> {
  const base = slugify(desired) || slugify(fallbackFrom) || "empresa";
  let candidate = base;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const existing = await prisma.company.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${base}-${randomSuffix()}`;
  }

  throw new AppError("Não foi possível gerar um identificador único.", 409);
}

export async function listCompanies(userId: string): Promise<CompanySummary[]> {
  const memberships = await prisma.companyMember.findMany({
    where: { userId, company: { archivedAt: null } },
    orderBy: { company: { createdAt: "asc" } },
    select: {
      role: true,
      company: {
        select: {
          id: true,
          name: true,
          slug: true,
          color: true,
          logoEmoji: true,
          createdAt: true,
          _count: { select: { members: true } },
          projects: {
            where: { archivedAt: null },
            select: { _count: { select: { tasks: true } } },
          },
          activities: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true },
          },
        },
      },
    },
  });

  return memberships.map(({ role, company }) => ({
    id: company.id,
    name: company.name,
    slug: company.slug,
    color: company.color,
    logoEmoji: company.logoEmoji,
    role: role as Role,
    projectCount: company.projects.length,
    memberCount: company._count.members,
    taskCount: company.projects.reduce((sum, p) => sum + p._count.tasks, 0),
    lastActivityAt: company.activities[0]?.createdAt.toISOString() ?? null,
    createdAt: company.createdAt.toISOString(),
  }));
}

export interface CompanyDetail {
  id: string;
  name: string;
  slug: string;
  color: string;
  logoEmoji: string | null;
  role: Role;
  createdAt: string;
  ownerId: string;
}

export async function getCompanyBySlug(
  userId: string,
  slug: string,
): Promise<CompanyDetail> {
  const company = await prisma.company.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      color: true,
      logoEmoji: true,
      createdAt: true,
      ownerId: true,
      archivedAt: true,
    },
  });

  if (!company || company.archivedAt) throw notFound();

  const { role } = await requireCompanyAccess(userId, company.id);

  return {
    id: company.id,
    name: company.name,
    slug: company.slug,
    color: company.color,
    logoEmoji: company.logoEmoji,
    role,
    ownerId: company.ownerId,
    createdAt: company.createdAt.toISOString(),
  };
}

interface CreateCompanyInput {
  name: string;
  slug?: string;
  color: string;
  logoEmoji?: string | null;
}

export async function createCompany(
  userId: string,
  input: CreateCompanyInput,
): Promise<CompanySummary> {
  const slug = await resolveSlug(input.slug ?? "", input.name);

  const company = await prisma.company.create({
    data: {
      name: input.name,
      slug,
      color: input.color,
      logoEmoji: input.logoEmoji ?? null,
      ownerId: userId,
      members: { create: { userId, role: "OWNER" } },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      color: true,
      logoEmoji: true,
      createdAt: true,
    },
  });

  await logActivity({
    companyId: company.id,
    actorId: userId,
    type: "company.created",
    message: `criou a empresa ${company.name}`,
  });

  return {
    ...company,
    role: "OWNER",
    projectCount: 0,
    memberCount: 1,
    taskCount: 0,
    lastActivityAt: company.createdAt.toISOString(),
    createdAt: company.createdAt.toISOString(),
  };
}

export async function updateCompany(
  userId: string,
  input: { companyId: string; name: string; color: string; logoEmoji?: string | null },
): Promise<void> {
  await requireCompanyAccess(userId, input.companyId, "ADMIN");

  const company = await prisma.company.update({
    where: { id: input.companyId },
    data: {
      name: input.name,
      color: input.color,
      logoEmoji: input.logoEmoji ?? null,
    },
    select: { id: true, name: true },
  });

  await logActivity({
    companyId: company.id,
    actorId: userId,
    type: "company.updated",
    message: `atualizou a empresa ${company.name}`,
  });
}

/** Arquivar mantém os dados; usado como "excluir" seguro na interface. */
export async function archiveCompany(userId: string, companyId: string): Promise<void> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { ownerId: true },
  });
  if (!company) throw notFound();
  if (company.ownerId !== userId) {
    throw forbidden("Apenas o proprietário pode arquivar a empresa.");
  }

  await prisma.company.update({
    where: { id: companyId },
    data: { archivedAt: new Date() },
  });
}

export async function deleteCompany(userId: string, companyId: string): Promise<void> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { ownerId: true },
  });
  if (!company) throw notFound();
  if (company.ownerId !== userId) {
    throw forbidden("Apenas o proprietário pode excluir a empresa.");
  }

  // O schema define onDelete: Cascade em toda a árvore abaixo de Company.
  await prisma.company.delete({ where: { id: companyId } });
}

// ---------------------------------------------------------------------------
// Membros
// ---------------------------------------------------------------------------

export interface MemberProjectAccess {
  projectId: string;
  name: string;
  color: string;
  icon: string | null;
  role: Role;
  /** true quando o acesso vem do papel na empresa, não de inclusão no projeto. */
  inherited: boolean;
}

export interface MemberEntry {
  userId: string;
  name: string;
  email: string;
  avatarColor: string;
  jobTitle: string | null;
  role: Role;
  isOwner: boolean;
  joinedAt: string;
  /** Projetos que esta pessoa enxerga, com o papel efetivo em cada um. */
  projects: MemberProjectAccess[];
}

/** Papel efetivo num projeto, dada a regra de herança. */
function effectiveProjectRole(
  companyRole: Role,
  projectRole: Role | undefined,
): { role: Role; inherited: boolean } | null {
  if (companyRole === "OWNER" || companyRole === "ADMIN") {
    return { role: companyRole, inherited: true };
  }
  if (!projectRole) return null;
  return { role: projectRole, inherited: false };
}

export async function listMembers(
  userId: string,
  companyId: string,
): Promise<MemberEntry[]> {
  await requireCompanyAccess(userId, companyId);

  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { ownerId: true },
  });

  const [members, projects] = await Promise.all([
    prisma.companyMember.findMany({
      where: { companyId },
      orderBy: { createdAt: "asc" },
      select: {
        role: true,
        createdAt: true,
        user: {
          select: { id: true, name: true, email: true, avatarColor: true, jobTitle: true },
        },
      },
    }),
    prisma.project.findMany({
      where: { companyId, archivedAt: null },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        color: true,
        icon: true,
        members: { select: { userId: true, role: true } },
      },
    }),
  ]);

  return members.map((m) => {
    const companyRole = m.role as Role;

    const access = projects.flatMap((project) => {
      const own = project.members.find((pm) => pm.userId === m.user.id);
      const effective = effectiveProjectRole(companyRole, own?.role as Role | undefined);
      if (!effective) return [];
      return [
        {
          projectId: project.id,
          name: project.name,
          color: project.color,
          icon: project.icon,
          role: effective.role,
          inherited: effective.inherited,
        },
      ];
    });

    return {
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      avatarColor: m.user.avatarColor,
      jobTitle: m.user.jobTitle,
      role: companyRole,
      isOwner: m.user.id === company.ownerId,
      joinedAt: m.createdAt.toISOString(),
      projects: access,
    };
  });
}

export interface ProjectAccessInput {
  projectId: string;
  role: Exclude<Role, "OWNER">;
}

export async function addMember(
  userId: string,
  input: {
    companyId: string;
    email: string;
    role: Exclude<Role, "OWNER">;
    projects?: ProjectAccessInput[];
  },
): Promise<void> {
  await requireCompanyAccess(userId, input.companyId, "ADMIN");

  const target = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, name: true },
  });

  if (!target) {
    throw new AppError("Nenhuma conta cadastrada com este e-mail.", 404);
  }

  const existing = await prisma.companyMember.findUnique({
    where: { companyId_userId: { companyId: input.companyId, userId: target.id } },
    select: { id: true },
  });
  if (existing) throw new AppError("Esta pessoa já faz parte da empresa.", 409);

  const projects = await validateProjectAccess(input.companyId, input.projects ?? []);

  await prisma.$transaction(async (tx) => {
    await tx.companyMember.create({
      data: { companyId: input.companyId, userId: target.id, role: input.role },
    });

    // Admin da empresa já acessa tudo; gravar linhas por projeto seria ruído.
    if (input.role !== "ADMIN" && projects.length > 0) {
      await tx.projectMember.createMany({
        data: projects.map((p) => ({
          projectId: p.projectId,
          userId: target.id,
          role: p.role,
        })),
      });
    }
  });

  await logActivity({
    companyId: input.companyId,
    actorId: userId,
    type: "member.added",
    message: `adicionou ${target.name} à empresa`,
  });
}

/** Garante que os projetos informados são desta empresa. Não confia no cliente. */
async function validateProjectAccess(
  companyId: string,
  projects: ProjectAccessInput[],
): Promise<ProjectAccessInput[]> {
  if (projects.length === 0) return [];

  const ids = [...new Set(projects.map((p) => p.projectId))];
  const found = await prisma.project.findMany({
    where: { id: { in: ids }, companyId },
    select: { id: true },
  });

  if (found.length !== ids.length) {
    throw new AppError("Projeto inválido para esta empresa.", 400);
  }
  return projects;
}

/** Substitui o conjunto de projetos que a pessoa acessa nesta empresa. */
export async function setMemberProjects(
  userId: string,
  input: { companyId: string; userId: string; projects: ProjectAccessInput[] },
): Promise<void> {
  await requireCompanyAccess(userId, input.companyId, "ADMIN");

  const member = await prisma.companyMember.findUnique({
    where: { companyId_userId: { companyId: input.companyId, userId: input.userId } },
    select: { role: true },
  });
  if (!member) throw notFound();

  if (member.role === "OWNER" || member.role === "ADMIN") {
    throw new AppError(
      "Proprietários e administradores acessam todos os projetos da empresa.",
      409,
    );
  }

  const projects = await validateProjectAccess(input.companyId, input.projects);
  const companyProjects = await prisma.project.findMany({
    where: { companyId: input.companyId },
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
    // Troca o conjunto inteiro: mais simples de raciocinar do que diferenciar.
    await tx.projectMember.deleteMany({
      where: {
        userId: input.userId,
        projectId: { in: companyProjects.map((p) => p.id) },
      },
    });
    if (projects.length > 0) {
      await tx.projectMember.createMany({
        data: projects.map((p) => ({
          projectId: p.projectId,
          userId: input.userId,
          role: p.role,
        })),
      });
    }
  });

  await logActivity({
    companyId: input.companyId,
    actorId: userId,
    type: "member.updated",
    message: "atualizou o acesso a projetos de um colaborador",
  });
}

export async function updateMemberRole(
  userId: string,
  input: { companyId: string; userId: string; role: Exclude<Role, "OWNER"> },
): Promise<void> {
  await requireCompanyAccess(userId, input.companyId, "ADMIN");

  const company = await prisma.company.findUniqueOrThrow({
    where: { id: input.companyId },
    select: { ownerId: true },
  });
  if (company.ownerId === input.userId) {
    throw forbidden("O papel do proprietário não pode ser alterado.");
  }

  const companyProjects = await prisma.project.findMany({
    where: { companyId: input.companyId },
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.companyMember.update({
      where: { companyId_userId: { companyId: input.companyId, userId: input.userId } },
      data: { role: input.role },
    });

    // Admin acessa todos os projetos por herança: manter linhas por projeto
    // criaria dois lugares dizendo a mesma coisa, que depois divergem.
    if (input.role === "ADMIN") {
      await tx.projectMember.deleteMany({
        where: {
          userId: input.userId,
          projectId: { in: companyProjects.map((p) => p.id) },
        },
      });
    }
  });

  await logActivity({
    companyId: input.companyId,
    actorId: userId,
    type: "member.updated",
    message: "atualizou permissões de um colaborador",
  });
}

export async function removeMember(
  userId: string,
  companyId: string,
  targetUserId: string,
): Promise<void> {
  await requireCompanyAccess(userId, companyId, "ADMIN");

  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { ownerId: true },
  });
  if (company.ownerId === targetUserId) {
    throw forbidden("O proprietário não pode ser removido da empresa.");
  }

  const companyProjects = await prisma.project.findMany({
    where: { companyId },
    select: { id: true },
  });

  await prisma.$transaction([
    prisma.companyMember.deleteMany({ where: { companyId, userId: targetUserId } }),
    // Sair da empresa tem de derrubar o acesso aos projetos dela também; senão
    // a linha órfã devolveria acesso se a pessoa fosse readicionada.
    prisma.projectMember.deleteMany({
      where: { userId: targetUserId, projectId: { in: companyProjects.map((p) => p.id) } },
    }),
  ]);

  await logActivity({
    companyId,
    actorId: userId,
    type: "member.removed",
    message: "removeu um colaborador da empresa",
  });
}
