import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import type { ActivityType } from "@/types/domain";

interface LogInput {
  companyId: string;
  actorId: string;
  type: ActivityType;
  message: string;
  projectId?: string | null;
  taskId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Registra uma entrada no histórico. Nunca deve derrubar a operação principal:
 * falha de log é engolida de propósito.
 */
export async function logActivity(
  input: LogInput,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<void> {
  try {
    await tx.activity.create({
      data: {
        companyId: input.companyId,
        actorId: input.actorId,
        type: input.type,
        message: input.message,
        projectId: input.projectId ?? null,
        taskId: input.taskId ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });
  } catch {
    // histórico é secundário — silencia
  }
}

export interface ActivityEntry {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  actor: { id: string; name: string; avatarColor: string };
  project: { id: string; name: string; color: string } | null;
}

/** Feed de atividade das empresas às quais o usuário pertence. */
export async function listAccountActivity(
  userId: string,
  limit = 12,
): Promise<ActivityEntry[]> {
  const memberships = await prisma.companyMember.findMany({
    where: { userId },
    select: { companyId: true },
  });
  const companyIds = memberships.map((m) => m.companyId);
  if (companyIds.length === 0) return [];

  const rows = await prisma.activity.findMany({
    where: { companyId: { in: companyIds } },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      message: true,
      createdAt: true,
      actor: { select: { id: true, name: true, avatarColor: true } },
      project: { select: { id: true, name: true, color: true } },
    },
  });

  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));
}
