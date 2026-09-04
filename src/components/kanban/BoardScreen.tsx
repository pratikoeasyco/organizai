"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, LayoutGrid, Pencil, Users } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { EmptyState } from "@/components/ui/EmptyState";
import { AvatarGroup } from "@/components/ui/Avatar";
import { useBoard } from "@/components/kanban/BoardProvider";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { CalendarView } from "@/components/calendar/CalendarView";
import { TaskPanel } from "@/components/kanban/TaskPanel";
import { AddColumnButton } from "@/components/kanban/AddColumnButton";
import { CreateTaskModal } from "@/components/kanban/CreateTaskModal";
import {
  BoardToolbar,
  EMPTY_FILTERS,
  type BoardFilters,
} from "@/components/kanban/BoardToolbar";
import { ProjectFormModal } from "@/components/projects/ProjectFormModal";
import { ProjectMuteToggle } from "@/components/notifications/ProjectMuteToggle";
import { matchesFilters } from "@/lib/board-filters";
import { dayKey } from "@/lib/calendar";
import { withAlpha } from "@/lib/utils/colors";
import { ROLE_LABEL, hasRole, type BoardColumnData } from "@/types/domain";

type View = "quadro" | "calendario";

const VIEWS: { id: View; label: string; icon: typeof LayoutGrid }[] = [
  { id: "quadro", label: "Quadro", icon: LayoutGrid },
  { id: "calendario", label: "Calendário", icon: CalendarDays },
];

export function BoardScreen() {
  const board = useBoard();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<BoardFilters>(EMPTY_FILTERS);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  // Criação de tarefa (quadro) e de compromisso (calendário) usam o mesmo
  // modal, mas são fluxos distintos: só um dos dois fica ativo por vez.
  const [newTaskColumn, setNewTaskColumn] = useState<BoardColumnData | null>(null);
  const [newEventDate, setNewEventDate] = useState<string | null>(null);

  // A visão fica na URL: sobrevive ao refresh e pode ser compartilhada.
  const view: View = searchParams.get("vista") === "calendario" ? "calendario" : "quadro";

  const setView = useCallback(
    (next: View) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "quadro") params.delete("vista");
      else params.set("vista", next);
      const query = params.toString();
      router.replace(`/projetos/${board.project.id}${query ? `?${query}` : ""}`, {
        scroll: false,
      });
    },
    [router, searchParams, board.project.id],
  );

  // Permite abrir uma tarefa direto por link (?tarefa=<id>), vindo do dashboard.
  useEffect(() => {
    const fromUrl = searchParams.get("tarefa");
    if (fromUrl) setOpenTaskId(fromUrl);
  }, [searchParams]);

  const handleCloseTask = useCallback(() => {
    setOpenTaskId(null);
    if (searchParams.get("tarefa")) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("tarefa");
      const query = params.toString();
      router.replace(`/projetos/${board.project.id}${query ? `?${query}` : ""}`, {
        scroll: false,
      });
    }
  }, [router, searchParams, board.project.id]);

  const openCreateOnDay = useCallback((date: Date) => {
    setNewTaskColumn(null);
    setNewEventDate(dayKey(date));
  }, []);

  const openCreateInColumn = useCallback((column: BoardColumnData) => {
    setNewEventDate(null);
    setNewTaskColumn(column);
  }, []);

  const totalTasks = board.columns.reduce((sum, column) => sum + column.tasks.length, 0);
  const visibleTasks = board.columns.reduce(
    (sum, column) =>
      sum + column.tasks.filter((task) => matchesFilters(task, filters)).length,
    0,
  );

  const canEditProject = hasRole(board.role, "MEMBER");
  const hasColumns = board.columns.length > 0;

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      {/* Cabeçalho do projeto */}
      <div className="shrink-0 border-b border-line bg-surface px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              style={{
                backgroundColor: withAlpha(board.project.color, 0.12),
                color: board.project.color,
              }}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg text-[16px]"
            >
              {board.project.icon ?? <LayoutGrid className="size-4.5" />}
            </span>

            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-[18px] font-semibold tracking-tight text-ink">
                <span className="truncate">{board.project.name}</span>
                {canEditProject && (
                  <button
                    type="button"
                    onClick={() => setEditOpen(true)}
                    aria-label="Editar projeto"
                    className="shrink-0 rounded-sm p-1 text-ink-faint transition-colors hover:bg-surface-sunken hover:text-ink"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                )}
              </h1>
              <p className="mt-0.5 truncate text-[12.5px] text-ink-muted">
                {board.project.description ||
                  `${board.project.companyName} · ${ROLE_LABEL[board.role]}`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Alternância de visão */}
            <div
              role="tablist"
              aria-label="Visualização do projeto"
              className="inline-flex shrink-0 rounded-md border border-line bg-surface p-0.5"
            >
              {VIEWS.map((option) => {
                const Icon = option.icon;
                const active = view === option.id;
                return (
                  <button
                    key={option.id}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setView(option.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                      active
                        ? "bg-brand-50 text-brand-700"
                        : "text-ink-muted hover:text-ink",
                    )}
                  >
                    <Icon className="size-3.5" />
                    {option.label}
                  </button>
                );
              })}
            </div>

            <BoardToolbar
              filters={filters}
              onChange={setFilters}
              members={board.members}
              labels={board.labels}
              resultCount={visibleTasks}
              totalCount={totalTasks}
            />

            <div className="ml-auto flex items-center gap-2 border-l border-line pl-3">
              <ProjectMuteToggle projectId={board.project.id} initialMuted={board.muted} />
              <span
                className="hidden items-center gap-2 lg:flex"
                title={`${board.members.length} membro(s)`}
              >
                <Users className="size-3.5 text-ink-faint" aria-hidden="true" />
                <AvatarGroup people={board.members} max={4} />
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="min-h-0 flex-1 pt-4">
        {!hasColumns ? (
          <div className="mx-auto max-w-lg px-6">
            <div className="card-surface">
              <EmptyState
                icon={<LayoutGrid />}
                title="Seu quadro está pronto"
                description="Comece criando as colunas que representam o seu fluxo de trabalho. Você pode criar quantas quiser."
                action={
                  board.canEdit ? (
                    <div className="flex justify-center">
                      <AddColumnButton />
                    </div>
                  ) : undefined
                }
              />
            </div>
          </div>
        ) : view === "calendario" ? (
          <CalendarView
            filters={filters}
            onOpenTask={setOpenTaskId}
            onCreateOnDay={openCreateOnDay}
          />
        ) : (
          <KanbanBoard
            filters={filters}
            onOpenTask={setOpenTaskId}
            onRequestCreateTask={openCreateInColumn}
          />
        )}
      </div>

      <CreateTaskModal
        column={newTaskColumn}
        eventDate={newEventDate}
        onClose={() => {
          setNewTaskColumn(null);
          setNewEventDate(null);
        }}
      />

      <TaskPanel taskId={openTaskId} onClose={handleCloseTask} />

      {canEditProject && (
        <ProjectFormModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          companyId={board.project.companyId}
          project={{
            id: board.project.id,
            name: board.project.name,
            description: board.project.description,
            color: board.project.color,
            icon: board.project.icon,
          }}
          navigateOnCreate={false}
        />
      )}
    </div>
  );
}
