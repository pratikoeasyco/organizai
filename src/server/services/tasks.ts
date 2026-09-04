import "server-only";

import { prisma } from "@/lib/db";
import { AppError, notFound, requireProjectAccess, requireTaskAccess } from "@/lib/auth/guards";
import { logActivity } from "@/server/services/activity";
import type { Priority, TaskDetail, TaskKind } from "@/types/domain";

// ---------------------------------------------------------------------------
// Detalhe da tarefa
// ---------------------------------------------------------------------------

export async function getTaskDetail(userId: string, taskId: string): Promise<TaskDetail> {
  await requireTaskAccess(userId, taskId, "VIEWER");

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      projectId: true,
      kind: true,
      columnId: true,
      title: true,
      description: true,
      priority: true,
      dueDate: true,
      hasTime: true,
      durationMinutes: true,
      completedAt: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
      assignee: { select: { id: true, name: true, email: true, avatarColor: true } },
      createdBy: { select: { id: true, name: true, email: true, avatarColor: true } },
      labels: { select: { label: { select: { id: true, name: true, color: true } } } },
      checklist: {
        orderBy: { position: "asc" },
        select: { id: true, content: true, done: true, position: true },
      },
      comments: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          body: true,
          createdAt: true,
          author: { select: { id: true, name: true, email: true, avatarColor: true } },
        },
      },
      attachments: {
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, url: true, createdAt: true },
      },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          type: true,
          message: true,
          createdAt: true,
          actor: { select: { id: true, name: true, avatarColor: true } },
        },
      },
      _count: { select: { comments: true, attachments: true } },
    },
  });

  if (!task) throw notFound();

  return {
    id: task.id,
    projectId: task.projectId,
    kind: task.kind as TaskKind,
    columnId: task.columnId,
    title: task.title,
    description: task.description,
    priority: task.priority as Priority,
    dueDate: task.dueDate?.toISOString() ?? null,
    hasTime: task.hasTime,
    durationMinutes: task.durationMinutes,
    completedAt: task.completedAt?.toISOString() ?? null,
    archivedAt: task.archivedAt?.toISOString() ?? null,
    assignee: task.assignee,
    createdBy: task.createdBy,
    labels: task.labels.map((l) => l.label),
    checklist: task.checklist,
    checklistTotal: task.checklist.length,
    checklistDone: task.checklist.filter((c) => c.done).length,
    comments: task.comments.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
    attachments: task.attachments.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    })),
    activity: task.activities.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    })),
    commentCount: task._count.comments,
    attachmentCount: task._count.attachments,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------

export async function addChecklistItem(
  userId: string,
  taskId: string,
  content: string,
): Promise<{ id: string; content: string; done: boolean; position: number }> {
  await requireTaskAccess(userId, taskId, "MEMBER");

  const last = await prisma.checklistItem.findFirst({
    where: { taskId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  return prisma.checklistItem.create({
    data: { taskId, content, position: (last?.position ?? -1) + 1 },
    select: { id: true, content: true, done: true, position: true },
  });
}

export async function updateChecklistItem(
  userId: string,
  itemId: string,
  input: { content?: string; done?: boolean },
): Promise<void> {
  const item = await prisma.checklistItem.findUnique({
    where: { id: itemId },
    select: { taskId: true },
  });
  if (!item) throw notFound();

  await requireTaskAccess(userId, item.taskId, "MEMBER");

  await prisma.checklistItem.update({
    where: { id: itemId },
    data: {
      ...(input.content !== undefined ? { content: input.content } : {}),
      ...(input.done !== undefined ? { done: input.done } : {}),
    },
  });
}

export async function deleteChecklistItem(userId: string, itemId: string): Promise<void> {
  const item = await prisma.checklistItem.findUnique({
    where: { id: itemId },
    select: { taskId: true },
  });
  if (!item) throw notFound();

  await requireTaskAccess(userId, item.taskId, "MEMBER");
  await prisma.checklistItem.delete({ where: { id: itemId } });
}

// ---------------------------------------------------------------------------
// Comentários
// ---------------------------------------------------------------------------

export async function addComment(
  userId: string,
  taskId: string,
  body: string,
): Promise<{
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string; email: string; avatarColor: string };
}> {
  const { companyId, projectId } = await requireTaskAccess(userId, taskId, "MEMBER");

  const comment = await prisma.taskComment.create({
    data: { taskId, authorId: userId, body },
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: { id: true, name: true, email: true, avatarColor: true } },
    },
  });

  await logActivity({
    companyId,
    actorId: userId,
    projectId,
    taskId,
    type: "task.commented",
    message: "comentou na tarefa",
  });

  return { ...comment, createdAt: comment.createdAt.toISOString() };
}

export async function deleteComment(userId: string, commentId: string): Promise<void> {
  const comment = await prisma.taskComment.findUnique({
    where: { id: commentId },
    select: { authorId: true, taskId: true },
  });
  if (!comment) throw notFound();

  const { role } = await requireTaskAccess(userId, comment.taskId, "MEMBER");

  // Autor apaga o próprio comentário; admin/owner moderam qualquer um.
  if (comment.authorId !== userId && role !== "ADMIN" && role !== "OWNER") {
    throw new AppError("Você só pode excluir seus próprios comentários.", 403);
  }

  await prisma.taskComment.delete({ where: { id: commentId } });
}

// ---------------------------------------------------------------------------
// Etiquetas do projeto
// ---------------------------------------------------------------------------

export async function createLabel(
  userId: string,
  input: { projectId: string; name: string; color: string },
): Promise<{ id: string; name: string; color: string }> {
  await requireProjectAccess(userId, input.projectId, "MEMBER");

  const count = await prisma.label.count({ where: { projectId: input.projectId } });
  if (count >= 40) throw new AppError("Limite de 40 etiquetas por projeto.", 409);

  return prisma.label.create({
    data: { projectId: input.projectId, name: input.name, color: input.color },
    select: { id: true, name: true, color: true },
  });
}

export async function updateLabel(
  userId: string,
  labelId: string,
  input: { name?: string; color?: string },
): Promise<{ id: string; name: string; color: string }> {
  const label = await prisma.label.findUnique({
    where: { id: labelId },
    select: { projectId: true },
  });
  if (!label) throw notFound();

  await requireProjectAccess(userId, label.projectId, "MEMBER");

  return prisma.label.update({
    where: { id: labelId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
    },
    select: { id: true, name: true, color: true },
  });
}

export async function deleteLabel(userId: string, labelId: string): Promise<void> {
  const label = await prisma.label.findUnique({
    where: { id: labelId },
    select: { projectId: true },
  });
  if (!label) throw notFound();

  await requireProjectAccess(userId, label.projectId, "MEMBER");
  await prisma.label.delete({ where: { id: labelId } });
}
