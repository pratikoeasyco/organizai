import "server-only";

import { notFound as renderNotFound, redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { getCurrentUser, type SessionUser } from "@/lib/auth/session";
import { AppError, forbidden, notFound, unauthorized } from "@/lib/errors";
import { hasRole, type Role } from "@/types/domain";

export { AppError, forbidden, notFound, unauthorized };

/** Usa em páginas: redireciona para /login quando não há sessão. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Usa em actions/handlers: lança AppError em vez de redirecionar. */
export async function requireUserOrThrow(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  return user;
}

/**
 * Exige administrador da plataforma numa **página**. Usa 404 em vez de 403 de
 * propósito: quem não é admin não deve nem descobrir que o painel existe.
 *
 * Esconder o link na interface não é proteção — a checagem tem de estar aqui.
 */
export async function requirePlatformAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // `renderNotFound` é o notFound do Next: renderiza a página 404 com o status
  // certo. O `notFound()` local é um AppError e viraria 500 numa página.
  if (!user.isPlatformAdmin) renderNotFound();
  return user;
}

/**
 * Mesma exigência para **server actions**, onde o controle de fluxo do Next não
 * se aplica: lança AppError para `toActionState` traduzir em mensagem.
 */
export async function requirePlatformAdminOrThrow(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  if (!user.isPlatformAdmin) throw notFound();
  return user;
}

export interface CompanyAccess {
  companyId: string;
  role: Role;
}

/**
 * Resolve o vínculo do usuário com a empresa e valida o papel mínimo.
 * Toda leitura e escrita de dados de empresa passa por aqui — é o ponto único
 * que garante que uma empresa não enxerga dados de outra.
 */
export async function requireCompanyAccess(
  userId: string,
  companyId: string,
  minRole: Role = "VIEWER",
): Promise<CompanyAccess> {
  const membership = await prisma.companyMember.findUnique({
    where: { companyId_userId: { companyId, userId } },
    select: { role: true, company: { select: { id: true, archivedAt: true } } },
  });

  // 404 em vez de 403 para não revelar a existência de IDs de outras empresas.
  if (!membership) throw notFound();

  const role = membership.role as Role;
  if (!hasRole(role, minRole)) throw forbidden();

  return { companyId: membership.company.id, role };
}

export interface ProjectAccess extends CompanyAccess {
  projectId: string;
}

/**
 * Acesso a um projeto. Pertencer à empresa não basta: quem é MEMBER ou VIEWER
 * só entra nos projetos em que foi incluído explicitamente.
 *
 *  - OWNER/ADMIN da empresa  -> todos os projetos, com o papel da empresa
 *  - MEMBER/VIEWER da empresa -> só onde existe ProjectMember; vale o papel de lá
 *
 * Sem acesso devolve 404, e não 403, para não revelar que o projeto existe.
 */
export async function requireProjectAccess(
  userId: string,
  projectId: string,
  minRole: Role = "VIEWER",
): Promise<ProjectAccess> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, companyId: true },
  });

  if (!project) throw notFound();

  // Primeiro o vínculo com a empresa, sem exigir papel mínimo ainda.
  const company = await requireCompanyAccess(userId, project.companyId);

  if (company.role === "OWNER" || company.role === "ADMIN") {
    if (!hasRole(company.role, minRole)) throw forbidden();
    return { ...company, projectId: project.id };
  }

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { role: true },
  });

  if (!membership) throw notFound();

  const role = membership.role as Role;
  if (!hasRole(role, minRole)) throw forbidden();

  return { companyId: project.companyId, role, projectId: project.id };
}

/**
 * Condição Prisma que restringe uma consulta de projetos ao que o usuário pode
 * ver. Usada nas listagens para não vazar nome de projeto na sidebar/dashboard.
 */
export function visibleProjectFilter(userId: string) {
  return {
    OR: [
      // Dono ou admin da empresa: todos os projetos dela.
      {
        company: {
          members: { some: { userId, role: { in: ["OWNER", "ADMIN"] } } },
        },
      },
      // Demais: só onde há acesso explícito ao projeto.
      { members: { some: { userId } } },
    ],
  };
}

/** Valida acesso a uma coluna garantindo que ela pertence ao projeto informado. */
export async function requireColumnAccess(
  userId: string,
  columnId: string,
  minRole: Role = "MEMBER",
): Promise<ProjectAccess & { columnId: string }> {
  const column = await prisma.boardColumn.findUnique({
    where: { id: columnId },
    select: { id: true, projectId: true },
  });

  if (!column) throw notFound();

  const access = await requireProjectAccess(userId, column.projectId, minRole);
  return { ...access, columnId: column.id };
}

export async function requireTaskAccess(
  userId: string,
  taskId: string,
  minRole: Role = "MEMBER",
): Promise<ProjectAccess & { taskId: string }> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, projectId: true },
  });

  if (!task) throw notFound();

  const access = await requireProjectAccess(userId, task.projectId, minRole);
  return { ...access, taskId: task.id };
}
