import "server-only";

import { prisma } from "@/lib/db";
import {
  AppError,
  notFound,
  requireColumnAccess,
  requireProjectAccess,
} from "@/lib/auth/guards";
import { logActivity } from "@/server/services/activity";
import { notify } from "@/server/services/notifications";
import { emitChange, type ChangeType } from "@/server/events/bus";
import { formatTimeRange, getFirstName } from "@/lib/utils/format";
import type {
  BoardColumnData,
  BoardData,
  BoardTask,
  CalendarEvent,
  Priority,
  Role,
} from "@/types/domain";

const MAX_COLUMNS = 40;

// ---------------------------------------------------------------------------
// Leitura do quadro
// ---------------------------------------------------------------------------

export async function getBoard(userId: string, projectId: string): Promise<BoardData> {
  const { role } = await requireProjectAccess(userId, projectId);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      description: true,
      color: true,
      icon: true,
      companyId: true,
      company: {
        select: {
          name: true,
          slug: true,
          members: {
            orderBy: { createdAt: "asc" },
            select: {
              user: { select: { id: true, name: true, email: true, avatarColor: true } },
            },
          },
        },
      },
      labels: {
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, color: true },
      },
      columns: {
        where: { archivedAt: null },
        orderBy: { position: "asc" },
        select: {
          id: true,
          name: true,
          color: true,
          position: true,
          tasks: {
            where: { archivedAt: null },
            orderBy: { position: "asc" },
            select: {
              id: true,
              columnId: true,
              title: true,
              description: true,
              priority: true,
              dueDate: true,
              hasTime: true,
              durationMinutes: true,
              position: true,
              createdAt: true,
              updatedAt: true,
              lastMovedAt: true,
              assignee: {
                select: { id: true, name: true, email: true, avatarColor: true },
              },
              lastMovedBy: { select: { id: true, name: true, avatarColor: true } },
              labels: {
                select: { label: { select: { id: true, name: true, color: true } } },
              },
              checklist: { select: { done: true } },
              _count: { select: { comments: true, attachments: true } },
            },
          },
        },
      },
    },
  });

  if (!project) throw notFound();

  // Compromissos não têm coluna, então nunca caem em `column.tasks`: quadro e
  // calendário ficam separados pela própria estrutura, não por um filtro.
  const columns: BoardColumnData[] = project.columns.map((column) => ({
    id: column.id,
    name: column.name,
    color: column.color,
    position: column.position,
    tasks: column.tasks.map((task) => toBoardTask({ ...task, columnId: column.id })),
  }));

  const [events, mute] = await Promise.all([
    prisma.task.findMany({
      where: { projectId, kind: "EVENT", archivedAt: null },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      select: calendarEventSelect,
    }),
    prisma.projectMute.findUnique({
      where: { userId_projectId: { userId, projectId } },
      select: { userId: true },
    }),
  ]);

  return {
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      color: project.color,
      icon: project.icon,
      companyId: project.companyId,
      companyName: project.company.name,
      companySlug: project.company.slug,
    },
    role: role as Role,
    currentUserId: userId,
    muted: Boolean(mute),
    columns,
    events: events.map(toCalendarEvent),
    labels: project.labels,
    members: project.company.members.map((m) => m.user),
  };
}

// ---------------------------------------------------------------------------
// Colunas
// ---------------------------------------------------------------------------

export async function createColumn(
  userId: string,
  input: { projectId: string; name: string; color: string },
): Promise<BoardColumnData> {
  const { companyId } = await requireProjectAccess(userId, input.projectId, "MEMBER");

  const count = await prisma.boardColumn.count({
    where: { projectId: input.projectId, archivedAt: null },
  });
  if (count >= MAX_COLUMNS) {
    throw new AppError(`Um projeto pode ter no máximo ${MAX_COLUMNS} colunas.`, 409);
  }

  const last = await prisma.boardColumn.findFirst({
    where: { projectId: input.projectId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const column = await prisma.boardColumn.create({
    data: {
      projectId: input.projectId,
      name: input.name,
      color: input.color,
      position: (last?.position ?? -1) + 1,
    },
    select: { id: true, name: true, color: true, position: true },
  });

  await touchProject(input.projectId, { companyId, actorId: userId, type: "column.changed" });
  await logActivity({
    companyId,
    actorId: userId,
    projectId: input.projectId,
    type: "column.created",
    message: `adicionou a coluna ${column.name}`,
  });

  return { ...column, tasks: [] };
}

export async function updateColumn(
  userId: string,
  columnId: string,
  input: { name?: string; color?: string },
): Promise<BoardColumnData> {
  const { companyId, projectId } = await requireColumnAccess(userId, columnId);

  const column = await prisma.boardColumn.update({
    where: { id: columnId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
    },
    select: { id: true, name: true, color: true, position: true },
  });

  await touchProject(projectId, { companyId, actorId: userId, type: "column.changed" });
  await logActivity({
    companyId,
    actorId: userId,
    projectId,
    type: "column.updated",
    message: `atualizou a coluna ${column.name}`,
  });

  return { ...column, tasks: [] };
}

/** Duplica a coluna (estrutura apenas, sem copiar as tarefas). */
export async function duplicateColumn(
  userId: string,
  columnId: string,
): Promise<BoardColumnData> {
  const { companyId, projectId } = await requireColumnAccess(userId, columnId);

  const source = await prisma.boardColumn.findUniqueOrThrow({
    where: { id: columnId },
    select: { name: true, color: true, position: true },
  });

  const created = await prisma.$transaction(async (tx) => {
    // Abre espaço logo depois da coluna original.
    await tx.boardColumn.updateMany({
      where: { projectId, position: { gt: source.position } },
      data: { position: { increment: 1 } },
    });

    return tx.boardColumn.create({
      data: {
        projectId,
        name: `${source.name} (cópia)`.slice(0, 40),
        color: source.color,
        position: source.position + 1,
      },
      select: { id: true, name: true, color: true, position: true },
    });
  });

  await touchProject(projectId, { companyId, actorId: userId, type: "column.changed" });

  return { ...created, tasks: [] };
}

export async function reorderColumns(
  userId: string,
  projectId: string,
  columnIds: string[],
): Promise<void> {
  const { companyId } = await requireProjectAccess(userId, projectId, "MEMBER");

  const owned = await prisma.boardColumn.findMany({
    where: { projectId, archivedAt: null },
    select: { id: true },
  });
  const ownedIds = new Set(owned.map((c) => c.id));

  // Rejeita IDs que não pertencem a este projeto (não confia no cliente).
  if (columnIds.some((id) => !ownedIds.has(id)) || columnIds.length !== ownedIds.size) {
    throw new AppError("Ordem de colunas inválida.", 400);
  }

  await prisma.$transaction(
    columnIds.map((id, index) =>
      prisma.boardColumn.update({ where: { id }, data: { position: index } }),
    ),
  );

  await touchProject(projectId, { companyId, actorId: userId, type: "column.changed" });
  await logActivity({
    companyId,
    actorId: userId,
    projectId,
    type: "column.reordered",
    message: "reordenou as colunas do quadro",
  });
}

interface DeleteColumnOptions {
  strategy: "move" | "archive" | "delete";
  targetColumnId?: string | null;
}

/**
 * Nunca apaga tarefas silenciosamente: o chamador escolhe explicitamente entre
 * mover para outra coluna, arquivar ou excluir junto.
 */
export async function deleteColumn(
  userId: string,
  columnId: string,
  options: DeleteColumnOptions,
): Promise<void> {
  const { companyId, projectId } = await requireColumnAccess(userId, columnId);

  const column = await prisma.boardColumn.findUniqueOrThrow({
    where: { id: columnId },
    select: { name: true, _count: { select: { tasks: { where: { archivedAt: null } } } } },
  });

  if (options.strategy === "move") {
    const targetId = options.targetColumnId;
    if (!targetId || targetId === columnId) {
      throw new AppError("Escolha a coluna de destino das tarefas.", 400);
    }
    const target = await prisma.boardColumn.findFirst({
      where: { id: targetId, projectId, archivedAt: null },
      select: { id: true },
    });
    if (!target) throw new AppError("Coluna de destino inválida.", 400);

    await prisma.$transaction(async (tx) => {
      const last = await tx.task.findFirst({
        where: { columnId: targetId, archivedAt: null },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      const moving = await tx.task.findMany({
        where: { columnId, archivedAt: null },
        orderBy: { position: "asc" },
        select: { id: true },
      });

      let next = (last?.position ?? -1) + 1;
      for (const task of moving) {
        await tx.task.update({
          where: { id: task.id },
          data: { columnId: targetId, position: next },
        });
        next += 1;
      }

      await tx.boardColumn.delete({ where: { id: columnId } });
    });
  } else if (options.strategy === "archive") {
    await prisma.$transaction([
      prisma.task.updateMany({
        where: { columnId, archivedAt: null },
        data: { archivedAt: new Date() },
      }),
      // Arquiva a própria coluna para preservar as tarefas arquivadas nela.
      prisma.boardColumn.update({
        where: { id: columnId },
        data: { archivedAt: new Date() },
      }),
    ]);
  } else {
    await prisma.boardColumn.delete({ where: { id: columnId } });
  }

  await touchProject(projectId, { companyId, actorId: userId, type: "column.changed" });
  await logActivity({
    companyId,
    actorId: userId,
    projectId,
    type: "column.deleted",
    message: `removeu a coluna ${column.name}${
      column._count.tasks > 0 ? ` (${column._count.tasks} tarefa(s) tratadas)` : ""
    }`,
  });
}

// ---------------------------------------------------------------------------
// Tarefas
// ---------------------------------------------------------------------------

const sharedTaskSelect = {
  id: true,
  title: true,
  description: true,
  priority: true,
  dueDate: true,
  hasTime: true,
  durationMinutes: true,
  createdAt: true,
  updatedAt: true,
  assignee: { select: { id: true, name: true, email: true, avatarColor: true } },
  labels: { select: { label: { select: { id: true, name: true, color: true } } } },
  checklist: { select: { done: true } },
  _count: { select: { comments: true, attachments: true } },
} as const;

const boardTaskSelect = {
  ...sharedTaskSelect,
  columnId: true,
  position: true,
  lastMovedAt: true,
  lastMovedBy: { select: { id: true, name: true, avatarColor: true } },
} as const;

const calendarEventSelect = {
  ...sharedTaskSelect,
  completedAt: true,
  reminderMinutes: true,
} as const;

interface RawShared {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  dueDate: Date | null;
  hasTime: boolean;
  durationMinutes: number | null;
  createdAt: Date;
  updatedAt: Date;
  assignee: { id: string; name: string; email: string; avatarColor: string } | null;
  labels: { label: { id: string; name: string; color: string } }[];
  checklist: { done: boolean }[];
  _count: { comments: number; attachments: number };
}

function toShared(task: RawShared) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    priority: task.priority as Priority,
    dueDate: task.dueDate?.toISOString() ?? null,
    hasTime: task.hasTime,
    durationMinutes: task.durationMinutes,
    assignee: task.assignee,
    labels: task.labels.map((l) => l.label),
    checklistTotal: task.checklist.length,
    checklistDone: task.checklist.filter((c) => c.done).length,
    commentCount: task._count.comments,
    attachmentCount: task._count.attachments,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

type RawBoardTask = RawShared & {
  columnId: string | null;
  position: number;
  lastMovedAt: Date | null;
  lastMovedBy: { id: string; name: string; avatarColor: string } | null;
};

export function toBoardTask(task: RawBoardTask): BoardTask {
  return {
    ...toShared(task),
    // Um card do quadro sempre tem coluna; o tipo do Prisma é nullable por
    // causa dos compromissos, que nunca chegam aqui.
    columnId: task.columnId ?? "",
    position: task.position,
    lastMovedBy: task.lastMovedBy,
    lastMovedAt: task.lastMovedAt?.toISOString() ?? null,
  };
}

type RawCalendarEvent = RawShared & {
  completedAt: Date | null;
  reminderMinutes: number | null;
};

export function toCalendarEvent(event: RawCalendarEvent): CalendarEvent {
  return {
    ...toShared(event),
    completedAt: event.completedAt?.toISOString() ?? null,
    reminderMinutes: event.reminderMinutes,
  };
}

export async function createTask(
  userId: string,
  input: {
    columnId: string;
    title: string;
    description?: string | null;
    priority?: Priority;
    dueDate?: Date | null;
    hasTime?: boolean;
    durationMinutes?: number | null;
    assigneeId?: string | null;
    position: "top" | "bottom";
  },
): Promise<BoardTask> {
  const { companyId, projectId } = await requireColumnAccess(userId, input.columnId);
  await assertAssignee(companyId, input.assigneeId);

  const task = await prisma.$transaction(async (tx) => {
    let position: number;

    if (input.position === "top") {
      await tx.task.updateMany({
        where: { columnId: input.columnId },
        data: { position: { increment: 1 } },
      });
      position = 0;
    } else {
      const last = await tx.task.findFirst({
        where: { columnId: input.columnId },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      position = (last?.position ?? -1) + 1;
    }

    return tx.task.create({
      data: {
        projectId,
        kind: "TASK",
        columnId: input.columnId,
        title: input.title,
        description: input.description ?? null,
        priority: input.priority ?? "LOW",
        dueDate: input.dueDate ?? null,
        hasTime: input.dueDate ? (input.hasTime ?? false) : false,
        durationMinutes: input.hasTime ? (input.durationMinutes ?? null) : null,
        assigneeId: input.assigneeId ?? null,
        position,
        createdById: userId,
      },
      select: boardTaskSelect,
    });
  });

  await touchProject(projectId, { companyId, actorId: userId, type: "task.changed" });
  await logActivity({
    companyId,
    actorId: userId,
    projectId,
    taskId: task.id,
    type: "task.created",
    message: `criou a tarefa ${task.title}`,
  });

  const actor = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });
  await notify({
    projectId,
    type: "task.created",
    actorId: userId,
    taskId: task.id,
    title: task.title,
    body: `${getFirstName(actor?.name ?? "Alguém")} criou uma tarefa${
      task.assignee ? ` para ${getFirstName(task.assignee.name)}` : ""
    }`,
    url: `/projetos/${projectId}?tarefa=${task.id}`,
  });

  return toBoardTask(task);
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  priority?: Priority;
  dueDate?: Date | null;
  hasTime?: boolean;
  durationMinutes?: number | null;
  assigneeId?: string | null;
  labelIds?: string[];
  archived?: boolean;
}

export async function updateTask(
  userId: string,
  taskId: string,
  input: UpdateTaskInput,
): Promise<BoardTask> {
  const existing = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, projectId: true, title: true },
  });
  if (!existing) throw notFound();

  const { companyId, projectId } = await requireProjectAccess(
    userId,
    existing.projectId,
    "MEMBER",
  );

  await assertAssignee(companyId, input.assigneeId);

  // Etiquetas precisam pertencer ao mesmo projeto.
  if (input.labelIds) {
    const valid = await prisma.label.findMany({
      where: { projectId, id: { in: input.labelIds } },
      select: { id: true },
    });
    if (valid.length !== input.labelIds.length) {
      throw new AppError("Etiqueta inválida.", 400);
    }
  }

  const task = await prisma.$transaction(async (tx) => {
    if (input.labelIds) {
      await tx.taskLabel.deleteMany({ where: { taskId } });
      if (input.labelIds.length > 0) {
        await tx.taskLabel.createMany({
          data: input.labelIds.map((labelId) => ({ taskId, labelId })),
        });
      }
    }

    return tx.task.update({
      where: { id: taskId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        // Remover a data zera hora e duração: um prazo inexistente não pode
        // continuar "às 14h por 30 min".
        ...(input.dueDate !== undefined
          ? input.dueDate === null
            ? { dueDate: null, hasTime: false, durationMinutes: null }
            : { dueDate: input.dueDate }
          : {}),
        ...(input.hasTime !== undefined
          ? input.hasTime
            ? { hasTime: true }
            : { hasTime: false, durationMinutes: null }
          : {}),
        ...(input.durationMinutes !== undefined
          ? { durationMinutes: input.durationMinutes }
          : {}),
        ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
        ...(input.archived !== undefined
          ? { archivedAt: input.archived ? new Date() : null }
          : {}),
      },
      select: boardTaskSelect,
    });
  });

  await touchProject(projectId, { companyId, actorId: userId, type: "task.changed" });
  await logActivity({
    companyId,
    actorId: userId,
    projectId,
    taskId,
    type: input.archived ? "task.archived" : "task.updated",
    message: input.archived
      ? `arquivou a tarefa ${task.title}`
      : `atualizou a tarefa ${task.title}`,
  });

  return toBoardTask(task);
}

/**
 * Move a tarefa para uma posição exata dentro de uma coluna e reindexa as
 * colunas afetadas na mesma transação — as posições ficam sempre densas (0..n).
 */
export async function moveTask(
  userId: string,
  input: { taskId: string; toColumnId: string; toIndex: number },
): Promise<BoardTask> {
  const task = await prisma.task.findUnique({
    where: { id: input.taskId },
    select: { id: true, projectId: true, columnId: true, title: true, kind: true },
  });
  if (!task) throw notFound();
  // Compromissos não vivem no quadro e não podem ser movidos entre colunas.
  if (task.kind !== "TASK") throw new AppError("Este item não pertence ao quadro.", 400);

  const { companyId, projectId } = await requireProjectAccess(
    userId,
    task.projectId,
    "MEMBER",
  );

  const target = await prisma.boardColumn.findFirst({
    where: { id: input.toColumnId, projectId, archivedAt: null },
    select: { id: true, name: true },
  });
  if (!target) throw new AppError("Coluna de destino inválida.", 400);

  const fromColumnId = task.columnId;

  await prisma.$transaction(async (tx) => {
    const targetTasks = await tx.task.findMany({
      where: { columnId: input.toColumnId, archivedAt: null, id: { not: input.taskId } },
      orderBy: { position: "asc" },
      select: { id: true },
    });

    const ids = targetTasks.map((t) => t.id);
    const index = Math.min(Math.max(input.toIndex, 0), ids.length);
    ids.splice(index, 0, input.taskId);

    for (let i = 0; i < ids.length; i += 1) {
      await tx.task.update({
        where: { id: ids[i] },
        data: {
          position: i,
          // Só o card movido registra autoria; os vizinhos apenas reindexam.
          ...(ids[i] === input.taskId
            ? {
                columnId: input.toColumnId,
                lastMovedById: userId,
                lastMovedAt: new Date(),
              }
            : {}),
        },
      });
    }

    if (fromColumnId !== input.toColumnId) {
      const remaining = await tx.task.findMany({
        where: { columnId: fromColumnId, archivedAt: null },
        orderBy: { position: "asc" },
        select: { id: true },
      });
      for (let i = 0; i < remaining.length; i += 1) {
        await tx.task.update({ where: { id: remaining[i].id }, data: { position: i } });
      }
    }
  });

  await touchProject(projectId, { companyId, actorId: userId, type: "task.changed" });

  if (fromColumnId !== input.toColumnId) {
    await logActivity({
      companyId,
      actorId: userId,
      projectId,
      taskId: task.id,
      type: "task.moved",
      message: `moveu a tarefa ${task.title} para ${target.name}`,
    });

    // Avisa o time. Quem moveu não recebe, e quem silenciou o projeto também
    // não — para os demais, continua chegando.
    const actor = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    await notify({
      projectId,
      type: "task.moved",
      actorId: userId,
      taskId: task.id,
      title: task.title,
      body: `${getFirstName(actor?.name ?? "Alguém")} moveu para ${target.name}`,
      url: `/projetos/${projectId}?tarefa=${task.id}`,
    });
  }

  const moved = await prisma.task.findUniqueOrThrow({
    where: { id: input.taskId },
    select: boardTaskSelect,
  });
  return toBoardTask(moved);
}

export async function deleteTask(userId: string, taskId: string): Promise<void> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, projectId: true, columnId: true, title: true },
  });
  if (!task) throw notFound();

  const { companyId, projectId } = await requireProjectAccess(
    userId,
    task.projectId,
    "MEMBER",
  );

  await prisma.$transaction(async (tx) => {
    await tx.task.delete({ where: { id: taskId } });

    const remaining = await tx.task.findMany({
      where: { columnId: task.columnId, archivedAt: null },
      orderBy: { position: "asc" },
      select: { id: true },
    });
    for (let i = 0; i < remaining.length; i += 1) {
      await tx.task.update({ where: { id: remaining[i].id }, data: { position: i } });
    }
  });

  await touchProject(projectId, { companyId, actorId: userId, type: "task.changed" });
  await logActivity({
    companyId,
    actorId: userId,
    projectId,
    type: "task.deleted",
    message: `excluiu a tarefa ${task.title}`,
  });
}

// ---------------------------------------------------------------------------
// Compromissos do calendário
//
// Vivem na mesma tabela das tarefas, mas com `columnId` nulo — o que os mantém
// fora de qualquer coluna e, portanto, fora do quadro. A conclusão é explícita
// (`completedAt`), já que não existe "última coluna" para eles.
// ---------------------------------------------------------------------------

export interface CreateEventInput {
  projectId: string;
  title: string;
  description?: string | null;
  priority?: Priority;
  dueDate: Date;
  hasTime: boolean;
  durationMinutes?: number | null;
  assigneeId?: string | null;
  reminderMinutes?: number | null;
}

export async function createEvent(
  userId: string,
  input: CreateEventInput,
): Promise<CalendarEvent> {
  const { companyId } = await requireProjectAccess(userId, input.projectId, "MEMBER");
  await assertAssignee(companyId, input.assigneeId);

  const event = await prisma.task.create({
    data: {
      projectId: input.projectId,
      kind: "EVENT",
      columnId: null,
      title: input.title,
      description: input.description ?? null,
      priority: input.priority ?? "LOW",
      dueDate: input.dueDate,
      hasTime: input.hasTime,
      durationMinutes: input.hasTime ? (input.durationMinutes ?? null) : null,
      assigneeId: input.assigneeId ?? null,
      // Lembrete só existe com horário: sem ele não há de quando contar.
      reminderMinutes: input.hasTime ? (input.reminderMinutes ?? null) : null,
      createdById: userId,
    },
    select: calendarEventSelect,
  });

  await touchProject(input.projectId, { companyId, actorId: userId, type: "event.changed" });
  await logActivity({
    companyId,
    actorId: userId,
    projectId: input.projectId,
    taskId: event.id,
    type: "task.created",
    message: `agendou ${event.title}`,
  });

  const actor = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });
  await notify({
    projectId: input.projectId,
    type: "event.created",
    actorId: userId,
    taskId: event.id,
    title: event.title,
    body: `${getFirstName(actor?.name ?? "Alguém")} agendou ${
      event.hasTime && event.dueDate
        ? formatTimeRange(event.dueDate, event.durationMinutes)
        : "para o dia todo"
    }`,
    url: `/projetos/${input.projectId}?vista=calendario&tarefa=${event.id}`,
  });

  return toCalendarEvent(event);
}

export interface UpdateEventInput {
  title?: string;
  description?: string | null;
  priority?: Priority;
  dueDate?: Date;
  hasTime?: boolean;
  durationMinutes?: number | null;
  assigneeId?: string | null;
  completed?: boolean;
  reminderMinutes?: number | null;
}

export async function updateEvent(
  userId: string,
  eventId: string,
  input: UpdateEventInput,
): Promise<CalendarEvent> {
  const existing = await prisma.task.findUnique({
    where: { id: eventId },
    select: { id: true, projectId: true, kind: true },
  });
  if (!existing || existing.kind !== "EVENT") throw notFound();

  const { companyId, projectId } = await requireProjectAccess(
    userId,
    existing.projectId,
    "MEMBER",
  );

  if (input.assigneeId) {
    const isMember = await prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId, userId: input.assigneeId } },
      select: { id: true },
    });
    if (!isMember) throw new AppError("Responsável inválido.", 400);
  }

  const event = await prisma.task.update({
    where: { id: eventId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      // Mudar a data reabre os avisos: o que já foi enviado valia para o
      // horário antigo e não serve mais.
      ...(input.dueDate !== undefined
        ? { dueDate: input.dueDate, reminderSentAt: null, startNotifiedAt: null }
        : {}),
      ...(input.reminderMinutes !== undefined
        ? { reminderMinutes: input.reminderMinutes, reminderSentAt: null }
        : {}),
      ...(input.hasTime !== undefined
        ? input.hasTime
          ? { hasTime: true }
          : { hasTime: false, durationMinutes: null, reminderMinutes: null }
        : {}),
      ...(input.durationMinutes !== undefined
        ? { durationMinutes: input.durationMinutes }
        : {}),
      ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
      ...(input.completed !== undefined
        ? { completedAt: input.completed ? new Date() : null }
        : {}),
    },
    select: calendarEventSelect,
  });

  await touchProject(projectId, { companyId, actorId: userId, type: "event.changed" });
  return toCalendarEvent(event);
}

export async function deleteEvent(userId: string, eventId: string): Promise<void> {
  const event = await prisma.task.findUnique({
    where: { id: eventId },
    select: { id: true, projectId: true, kind: true, title: true },
  });
  if (!event || event.kind !== "EVENT") throw notFound();

  const { companyId, projectId } = await requireProjectAccess(
    userId,
    event.projectId,
    "MEMBER",
  );

  await prisma.task.delete({ where: { id: eventId } });
  await touchProject(projectId, { companyId, actorId: userId, type: "event.changed" });
  await logActivity({
    companyId,
    actorId: userId,
    projectId,
    type: "task.deleted",
    message: `removeu o compromisso ${event.title}`,
  });
}

/**
 * O responsável precisa ser membro da empresa dona do projeto. Vale tanto na
 * criação quanto na edição — sem isso, o cliente poderia atribuir uma tarefa a
 * qualquer id de usuário do sistema.
 */
async function assertAssignee(
  companyId: string,
  assigneeId: string | null | undefined,
): Promise<void> {
  if (!assigneeId) return;

  const isMember = await prisma.companyMember.findUnique({
    where: { companyId_userId: { companyId, userId: assigneeId } },
    select: { id: true },
  });
  if (!isMember) throw new AppError("Responsável inválido.", 400);
}

/**
 * Marca o projeto como alterado e avisa quem está com ele aberto.
 *
 * Toda mutação do quadro passa por aqui, então publicar a mudança neste ponto
 * garante que nenhuma operação fique sem aviso — bem mais seguro do que
 * espalhar `emitChange` por onze lugares e torcer para não esquecer um.
 */
async function touchProject(
  projectId: string,
  change?: { companyId: string; actorId: string; type: ChangeType },
): Promise<void> {
  await prisma.project
    .update({ where: { id: projectId }, data: { updatedAt: new Date() } })
    .catch(() => undefined);

  if (change) {
    emitChange({
      type: change.type,
      companyId: change.companyId,
      projectId,
      actorId: change.actorId,
    });
  }
}
