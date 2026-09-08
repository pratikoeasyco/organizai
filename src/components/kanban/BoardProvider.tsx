"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { api } from "@/lib/api-client";
import { clockOf, isoForDayAndTime } from "@/lib/calendar";
import { useLiveChanges } from "@/hooks/useLiveChanges";
import { useToast } from "@/components/ui/Toast";
import type {
  BoardColumnData,
  BoardData,
  BoardLabel,
  BoardTask,
  CalendarEvent,
  Priority,
  Role,
  TaskDetail,
} from "@/types/domain";
import { hasRole } from "@/types/domain";

export interface NewTaskInput {
  title: string;
  description: string | null;
  priority: Priority;
  /** "YYYY-MM-DD" ou vazio. Opcional na tarefa do quadro. */
  dueDate?: string | null;
  assigneeId?: string | null;
}

export interface NewEventInput {
  title: string;
  description: string | null;
  priority: Priority;
  /** "YYYY-MM-DD" ou "YYYY-MM-DDTHH:mm" — sempre interpretado em hora local. */
  dueDate: string;
  hasTime: boolean;
  durationMinutes: number | null;
  assigneeId?: string | null;
  reminderMinutes?: number | null;
}

interface BoardContextValue {
  project: BoardData["project"];
  role: Role;
  currentUserId: string;
  /** Este usuário silenciou as notificações deste projeto. */
  muted: boolean;
  canEdit: boolean;
  columns: BoardColumnData[];
  events: CalendarEvent[];
  labels: BoardLabel[];
  members: BoardData["members"];

  // --- Colunas ---
  createColumn: (input: { name: string; color: string }) => Promise<boolean>;
  updateColumn: (columnId: string, input: { name?: string; color?: string }) => Promise<void>;
  duplicateColumn: (columnId: string) => Promise<void>;
  deleteColumn: (
    columnId: string,
    options: { strategy: "move" | "archive" | "delete"; targetColumnId?: string | null },
  ) => Promise<void>;
  reorderColumns: (columnIds: string[]) => Promise<void>;

  // --- Tarefas (quadro) ---
  createTask: (columnId: string, input: NewTaskInput) => Promise<boolean>;
  moveTask: (
    taskId: string,
    toColumnId: string,
    toIndex: number,
    priority?: Priority,
  ) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  removeTaskLocal: (taskId: string) => void;

  // --- Compromissos (calendário) ---
  createEvent: (input: NewEventInput) => Promise<boolean>;
  rescheduleEvent: (eventId: string, targetDayKey: string) => Promise<void>;
  setEventDone: (eventId: string, done: boolean) => Promise<void>;
  deleteEvent: (eventId: string) => Promise<void>;

  /** Sincroniza o quadro ou o calendário após edição no painel de detalhes. */
  syncDetail: (detail: TaskDetail) => void;
  addLabel: (label: BoardLabel) => void;
}

const BoardContext = createContext<BoardContextValue | null>(null);

function withoutTask(columns: BoardColumnData[], taskId: string): BoardColumnData[] {
  return columns.map((column) => ({
    ...column,
    tasks: column.tasks.filter((task) => task.id !== taskId),
  }));
}

export function BoardProvider({
  initial,
  children,
}: {
  initial: BoardData;
  children: ReactNode;
}) {
  const toast = useToast();
  const [columns, setColumns] = useState<BoardColumnData[]>(initial.columns);
  const [events, setEvents] = useState<CalendarEvent[]>(initial.events);
  const [labels, setLabels] = useState<BoardLabel[]>(initial.labels);
  const canEdit = hasRole(initial.role, "MEMBER");

  const rollback = useRef<BoardColumnData[]>(initial.columns);

  /**
   * Recarrega o quadro inteiro a partir do servidor.
   *
   * Usado quando outra pessoa mexe neste projeto. Rebuscar tudo é mais simples
   * — e mais confiável — do que aplicar cada evento em cima do estado local:
   * uma reordenação vinda de fora exigiria recalcular posições que já podem ter
   * mudado aqui. O payload de um quadro é pequeno.
   */
  const reload = useCallback(async () => {
    try {
      const { board } = await api.get<{ board: BoardData }>(
        `/api/projects/${initial.project.id}/board`,
      );
      setColumns(board.columns);
      setEvents(board.events);
      setLabels(board.labels);
    } catch {
      // Sem rede ou acesso revogado: mantém o que está na tela.
    }
  }, [initial.project.id]);

  // Só reage a mudanças DESTE projeto; as demais são tratadas pelo AppShell.
  useLiveChanges(
    useCallback(
      (event) => {
        if (event.projectId === initial.project.id) void reload();
      },
      [initial.project.id, reload],
    ),
  );

  const runOptimistic = useCallback(
    async (
      apply: (current: BoardColumnData[]) => BoardColumnData[],
      persist: () => Promise<void>,
      errorMessage: string,
    ): Promise<boolean> => {
      let previous: BoardColumnData[] = [];
      setColumns((current) => {
        previous = current;
        return apply(current);
      });
      rollback.current = previous;

      try {
        await persist();
        return true;
      } catch (error) {
        setColumns(rollback.current);
        toast.error(errorMessage, error instanceof Error ? error.message : undefined);
        return false;
      }
    },
    [toast],
  );

  // -------------------------------------------------------------------------
  // Colunas
  // -------------------------------------------------------------------------

  const createColumn = useCallback(
    async (input: { name: string; color: string }) => {
      try {
        const { column } = await api.post<{ column: BoardColumnData }>("/api/columns", {
          projectId: initial.project.id,
          ...input,
        });
        setColumns((current) => [...current, { ...column, tasks: [] }]);
        toast.success("Coluna criada.");
        return true;
      } catch (error) {
        toast.error(
          "Não foi possível criar a coluna.",
          error instanceof Error ? error.message : undefined,
        );
        return false;
      }
    },
    [initial.project.id, toast],
  );

  const updateColumn = useCallback(
    async (columnId: string, input: { name?: string; color?: string }) => {
      const ok = await runOptimistic(
        (current) =>
          current.map((column) => (column.id === columnId ? { ...column, ...input } : column)),
        async () => {
          await api.patch(`/api/columns/${columnId}`, input);
        },
        "Não foi possível atualizar a coluna.",
      );
      if (ok) toast.success("Coluna atualizada.");
    },
    [runOptimistic, toast],
  );

  const duplicateColumn = useCallback(
    async (columnId: string) => {
      try {
        const { column } = await api.post<{ column: BoardColumnData }>(
          `/api/columns/${columnId}/duplicate`,
        );
        setColumns((current) => {
          const index = current.findIndex((item) => item.id === columnId);
          const next = [...current];
          next.splice(index + 1, 0, { ...column, tasks: [] });
          return next;
        });
        toast.success("Coluna duplicada.");
      } catch (error) {
        toast.error(
          "Não foi possível duplicar a coluna.",
          error instanceof Error ? error.message : undefined,
        );
      }
    },
    [toast],
  );

  const deleteColumn = useCallback(
    async (
      columnId: string,
      options: { strategy: "move" | "archive" | "delete"; targetColumnId?: string | null },
    ) => {
      const ok = await runOptimistic(
        (current) => {
          const source = current.find((column) => column.id === columnId);
          const moving = options.strategy === "move" ? (source?.tasks ?? []) : [];

          return current
            .filter((column) => column.id !== columnId)
            .map((column) =>
              column.id === options.targetColumnId
                ? {
                    ...column,
                    tasks: [
                      ...column.tasks,
                      ...moving.map((task) => ({ ...task, columnId: column.id })),
                    ],
                  }
                : column,
            );
        },
        async () => {
          await api.delete(`/api/columns/${columnId}`, options);
        },
        "Não foi possível excluir a coluna.",
      );
      if (ok) toast.success("Coluna removida.");
    },
    [runOptimistic, toast],
  );

  const reorderColumns = useCallback(
    async (columnIds: string[]) => {
      await runOptimistic(
        (current) =>
          columnIds
            .map((id) => current.find((column) => column.id === id))
            .filter((column): column is BoardColumnData => Boolean(column)),
        async () => {
          await api.patch("/api/columns", { projectId: initial.project.id, columnIds });
        },
        "Não foi possível reordenar as colunas.",
      );
    },
    [runOptimistic, initial.project.id],
  );

  // -------------------------------------------------------------------------
  // Tarefas do quadro
  // -------------------------------------------------------------------------

  const createTask = useCallback(
    async (columnId: string, input: NewTaskInput) => {
      try {
        const { task } = await api.post<{ task: BoardTask }>("/api/tasks", {
          columnId,
          ...input,
          description: input.description ?? "",
          dueDate: input.dueDate ?? "",
          position: "bottom",
        });
        setColumns((current) =>
          current.map((column) =>
            column.id === columnId ? { ...column, tasks: [...column.tasks, task] } : column,
          ),
        );
        toast.success("Tarefa criada.");
        return true;
      } catch (error) {
        toast.error(
          "Não foi possível criar a tarefa.",
          error instanceof Error ? error.message : undefined,
        );
        return false;
      }
    },
    [toast],
  );

  const moveTask = useCallback(
    async (taskId: string, toColumnId: string, toIndex: number, priority?: Priority) => {
      let movedToOtherColumn = false;
      let targetName = "";

      const ok = await runOptimistic(
        (current) => {
          const task = current.flatMap((c) => c.tasks).find((item) => item.id === taskId);
          if (!task) return current;

          movedToOtherColumn = task.columnId !== toColumnId;
          targetName = current.find((column) => column.id === toColumnId)?.name ?? "";

          const stripped = withoutTask(current, taskId);
          return stripped.map((column) => {
            if (column.id !== toColumnId) return column;
            const tasks = [...column.tasks];
            tasks.splice(Math.min(toIndex, tasks.length), 0, {
              ...task,
              columnId: toColumnId,
              // A prioridade nova entra já no otimista: é ela que decide onde o
              // card fica depois que a coluna for reordenada.
              ...(priority ? { priority } : {}),
            });
            return { ...column, tasks };
          });
        },
        async () => {
          const { task } = await api.post<{ task: BoardTask }>("/api/tasks/move", {
            taskId,
            toColumnId,
            toIndex,
            ...(priority ? { priority } : {}),
          });
          // A resposta traz quem moveu, para o rodapé do card ficar correto
          // sem depender de um novo carregamento.
          setColumns((current) =>
            current.map((column) => ({
              ...column,
              tasks: column.tasks.map((item) => (item.id === taskId ? task : item)),
            })),
          );
        },
        "Não foi possível mover a tarefa.",
      );

      if (ok && movedToOtherColumn && targetName) {
        toast.success(`Tarefa movida para ${targetName}.`);
      }
    },
    [runOptimistic, toast],
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      const ok = await runOptimistic(
        (current) => withoutTask(current, taskId),
        async () => {
          await api.delete(`/api/tasks/${taskId}`);
        },
        "Não foi possível excluir a tarefa.",
      );
      if (ok) toast.success("Tarefa excluída.");
    },
    [runOptimistic, toast],
  );

  const removeTaskLocal = useCallback((taskId: string) => {
    setColumns((current) => withoutTask(current, taskId));
  }, []);

  // -------------------------------------------------------------------------
  // Compromissos do calendário
  // -------------------------------------------------------------------------

  const createEvent = useCallback(
    async (input: NewEventInput) => {
      try {
        const { event } = await api.post<{ event: CalendarEvent }>("/api/events", {
          projectId: initial.project.id,
          ...input,
          description: input.description ?? "",
        });
        setEvents((current) => [...current, event]);
        toast.success("Compromisso agendado.");
        return true;
      } catch (error) {
        toast.error(
          "Não foi possível agendar.",
          error instanceof Error ? error.message : undefined,
        );
        return false;
      }
    },
    [initial.project.id, toast],
  );

  const rescheduleEvent = useCallback(
    async (eventId: string, targetDayKey: string) => {
      const event = events.find((item) => item.id === eventId);
      if (!event || !event.dueDate) return;

      const time = event.hasTime ? clockOf(new Date(event.dueDate)) : null;
      const payload = time ? `${targetDayKey}T${time}` : targetDayKey;

      const previous = events;
      setEvents((current) =>
        current.map((item) =>
          item.id === eventId
            ? { ...item, dueDate: isoForDayAndTime(targetDayKey, time) }
            : item,
        ),
      );

      try {
        const { event: saved } = await api.patch<{ event: CalendarEvent }>(
          `/api/events/${eventId}`,
          { dueDate: payload },
        );
        setEvents((current) => current.map((item) => (item.id === eventId ? saved : item)));
        toast.success("Compromisso remarcado.");
      } catch (error) {
        setEvents(previous);
        toast.error(
          "Não foi possível remarcar.",
          error instanceof Error ? error.message : undefined,
        );
      }
    },
    [events, toast],
  );

  const setEventDone = useCallback(
    async (eventId: string, done: boolean) => {
      const previous = events;
      setEvents((current) =>
        current.map((item) =>
          item.id === eventId
            ? { ...item, completedAt: done ? new Date().toISOString() : null }
            : item,
        ),
      );

      try {
        const { event } = await api.patch<{ event: CalendarEvent }>(`/api/events/${eventId}`, {
          completed: done,
        });
        setEvents((current) => current.map((item) => (item.id === eventId ? event : item)));
      } catch (error) {
        setEvents(previous);
        toast.error(
          "Não foi possível atualizar o compromisso.",
          error instanceof Error ? error.message : undefined,
        );
      }
    },
    [events, toast],
  );

  const deleteEvent = useCallback(
    async (eventId: string) => {
      const previous = events;
      setEvents((current) => current.filter((item) => item.id !== eventId));

      try {
        await api.delete(`/api/events/${eventId}`);
        toast.success("Compromisso excluído.");
      } catch (error) {
        setEvents(previous);
        toast.error(
          "Não foi possível excluir.",
          error instanceof Error ? error.message : undefined,
        );
      }
    },
    [events, toast],
  );

  // -------------------------------------------------------------------------

  const syncDetail = useCallback((detail: TaskDetail) => {
    if (detail.kind === "EVENT") {
      setEvents((current) =>
        current.map((item) =>
          item.id === detail.id
            ? {
                ...item,
                title: detail.title,
                description: detail.description,
                priority: detail.priority,
                dueDate: detail.dueDate,
                hasTime: detail.hasTime,
                durationMinutes: detail.durationMinutes,
                assignee: detail.assignee,
                labels: detail.labels,
                checklistTotal: detail.checklistTotal,
                checklistDone: detail.checklistDone,
                commentCount: detail.commentCount,
                attachmentCount: detail.attachmentCount,
                completedAt: detail.completedAt,
                updatedAt: detail.updatedAt,
              }
            : item,
        ),
      );
      return;
    }

    setColumns((current) =>
      current.map((column) => ({
        ...column,
        tasks: column.tasks.map((task) =>
          task.id === detail.id
            ? {
                ...task,
                title: detail.title,
                description: detail.description,
                priority: detail.priority,
                dueDate: detail.dueDate,
                hasTime: detail.hasTime,
                durationMinutes: detail.durationMinutes,
                assignee: detail.assignee,
                labels: detail.labels,
                checklistTotal: detail.checklistTotal,
                checklistDone: detail.checklistDone,
                commentCount: detail.commentCount,
                attachmentCount: detail.attachmentCount,
                updatedAt: detail.updatedAt,
              }
            : task,
        ),
      })),
    );
  }, []);

  const addLabel = useCallback((label: BoardLabel) => {
    setLabels((current) => [...current, label]);
  }, []);

  const value = useMemo<BoardContextValue>(
    () => ({
      project: initial.project,
      role: initial.role,
      currentUserId: initial.currentUserId,
      muted: initial.muted,
      members: initial.members,
      canEdit,
      columns,
      events,
      labels,
      createColumn,
      updateColumn,
      duplicateColumn,
      deleteColumn,
      reorderColumns,
      createTask,
      moveTask,
      deleteTask,
      removeTaskLocal,
      createEvent,
      rescheduleEvent,
      setEventDone,
      deleteEvent,
      syncDetail,
      addLabel,
    }),
    [
      initial.project,
      initial.role,
      initial.currentUserId,
      initial.muted,
      initial.members,
      canEdit,
      columns,
      events,
      labels,
      createColumn,
      updateColumn,
      duplicateColumn,
      deleteColumn,
      reorderColumns,
      createTask,
      moveTask,
      deleteTask,
      removeTaskLocal,
      createEvent,
      rescheduleEvent,
      setEventDone,
      deleteEvent,
      syncDetail,
      addLabel,
    ],
  );

  return <BoardContext.Provider value={value}>{children}</BoardContext.Provider>;
}

export function useBoard(): BoardContextValue {
  const context = useContext(BoardContext);
  if (!context) throw new Error("useBoard precisa estar dentro de <BoardProvider>.");
  return context;
}
