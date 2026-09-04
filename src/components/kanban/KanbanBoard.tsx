"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { useBoard } from "@/components/kanban/BoardProvider";
import { KanbanColumn } from "@/components/kanban/KanbanColumn";
import { TaskCardPreview } from "@/components/kanban/TaskCard";
import { DeleteColumnDialog } from "@/components/kanban/DeleteColumnDialog";
import { AddColumnButton } from "@/components/kanban/AddColumnButton";
import { matchesFilters } from "@/lib/board-filters";
import type { BoardColumnData, BoardTask } from "@/types/domain";
import type { BoardFilters } from "@/components/kanban/BoardToolbar";

function findColumnByTask(columns: BoardColumnData[], taskId: string) {
  return columns.find((column) => column.tasks.some((task) => task.id === taskId));
}

/** Move uma tarefa entre colunas dentro de um array de colunas (imutável). */
function relocate(
  columns: BoardColumnData[],
  taskId: string,
  toColumnId: string,
  toIndex: number,
): BoardColumnData[] {
  const task = columns.flatMap((column) => column.tasks).find((item) => item.id === taskId);
  if (!task) return columns;

  return columns.map((column) => {
    const withoutTask = column.tasks.filter((item) => item.id !== taskId);
    if (column.id !== toColumnId) return { ...column, tasks: withoutTask };

    const tasks = [...withoutTask];
    tasks.splice(Math.min(Math.max(toIndex, 0), tasks.length), 0, {
      ...task,
      columnId: toColumnId,
    });
    return { ...column, tasks };
  });
}

export interface KanbanBoardProps {
  filters: BoardFilters;
  onOpenTask: (taskId: string) => void;
  /** O modal de criação vive na tela do projeto, compartilhado com o calendário. */
  onRequestCreateTask: (column: BoardColumnData) => void;
}

export function KanbanBoard({ filters, onOpenTask, onRequestCreateTask }: KanbanBoardProps) {
  const board = useBoard();
  const {
    columns,
    canEdit,
    moveTask,
    reorderColumns,
    updateColumn,
    duplicateColumn,
    deleteColumn,
  } = board;

  // Enquanto arrasta, o quadro renderiza esta cópia — permite mostrar o card já
  // encaixado na coluna de destino antes de soltar.
  const [preview, setPreview] = useState<BoardColumnData[] | null>(null);
  const [activeTask, setActiveTask] = useState<BoardTask | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [columnToDelete, setColumnToDelete] = useState<BoardColumnData | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const view = preview ?? columns;

  /**
   * Com uma única coluna não faz sentido tratá-la como "concluído" — todo o
   * quadro apareceria finalizado. A mesma regra vale no dashboard.
   */
  const doneColumnId = view.length > 1 ? view[view.length - 1].id : null;

  const filtered = useMemo(
    () =>
      view.map((column) => ({
        column,
        tasks: column.tasks.filter((task) => matchesFilters(task, filters)),
      })),
    [view, filters],
  );

  // Cursor global de "arrastando" — some com o cursor de texto durante o drag.
  useEffect(() => {
    const dragging = Boolean(activeTask || activeColumnId);
    document.body.classList.toggle("dnd-dragging-cursor", dragging);
    return () => document.body.classList.remove("dnd-dragging-cursor");
  }, [activeTask, activeColumnId]);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const type = event.active.data.current?.type;
      if (type === "column") {
        setActiveColumnId(String(event.active.id));
        return;
      }
      const task = columns
        .flatMap((column) => column.tasks)
        .find((item) => item.id === event.active.id);
      setActiveTask(task ?? null);
      setPreview(columns);
    },
    [columns],
  );

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || active.data.current?.type !== "task") return;

    const activeId = String(active.id);
    const overId = String(over.id);

    setPreview((current) => {
      if (!current) return current;

      const from = findColumnByTask(current, activeId);
      if (!from) return current;

      // Soltou sobre a área vazia de uma coluna.
      if (overId.startsWith("column-drop-")) {
        const toColumnId = overId.replace("column-drop-", "");
        if (from.id === toColumnId) return current;
        const target = current.find((column) => column.id === toColumnId);
        return relocate(current, activeId, toColumnId, target?.tasks.length ?? 0);
      }

      // Soltou sobre outro card.
      const overColumn = findColumnByTask(current, overId);
      if (!overColumn || overColumn.id === from.id) return current;

      const overIndex = overColumn.tasks.findIndex((task) => task.id === overId);
      return relocate(current, activeId, overColumn.id, Math.max(overIndex, 0));
    });
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      const type = active.data.current?.type;

      setActiveTask(null);
      setActiveColumnId(null);

      if (!over) {
        setPreview(null);
        return;
      }

      if (type === "column") {
        const oldIndex = columns.findIndex((column) => column.id === active.id);
        const newIndex = columns.findIndex((column) => column.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          const ordered = arrayMove(columns, oldIndex, newIndex);
          void reorderColumns(ordered.map((column) => column.id));
        }
        return;
      }

      const current = preview ?? columns;
      const activeId = String(active.id);
      const overId = String(over.id);

      const from = findColumnByTask(current, activeId);
      if (!from) {
        setPreview(null);
        return;
      }

      let toColumnId = from.id;
      let toIndex = from.tasks.findIndex((task) => task.id === activeId);

      if (overId.startsWith("column-drop-")) {
        const targetId = overId.replace("column-drop-", "");
        const target = current.find((column) => column.id === targetId);
        if (target) {
          toColumnId = targetId;
          // `from` já reflete o preview do arraste; se for a mesma coluna, a
          // posição atual do card é a final.
          toIndex = target.id === from.id ? toIndex : target.tasks.length;
        }
      } else if (overId !== activeId) {
        const overColumn = findColumnByTask(current, overId);
        if (overColumn) {
          toColumnId = overColumn.id;
          toIndex = overColumn.tasks.findIndex((task) => task.id === overId);
        }
      }

      // Reordenação dentro da mesma coluna: aplica o arrayMove final.
      const original = findColumnByTask(columns, activeId);
      const originalIndex =
        original?.tasks.findIndex((task) => task.id === activeId) ?? -1;

      setPreview(null);

      const unchanged =
        original?.id === toColumnId && originalIndex === toIndex && originalIndex !== -1;
      if (unchanged) return;

      void moveTask(activeId, toColumnId, Math.max(toIndex, 0));
    },
    [columns, preview, moveTask, reorderColumns],
  );

  const handleDragCancel = useCallback(() => {
    setActiveTask(null);
    setActiveColumnId(null);
    setPreview(null);
  }, []);

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="group/board h-full overflow-x-auto scrollbar-slim">
          <div className="flex h-full min-h-[420px] items-stretch gap-3 px-5 pb-5 sm:px-6">
            <SortableContext
              items={columns.map((column) => column.id)}
              strategy={horizontalListSortingStrategy}
            >
              {filtered.map(({ column, tasks }) => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  tasks={tasks}
                  totalTasks={column.tasks.length}
                  canEdit={canEdit}
                  isDoneColumn={column.id === doneColumnId}
                  onOpenTask={onOpenTask}
                  onCreateTask={onRequestCreateTask}
                  onRename={(columnId, name) => void updateColumn(columnId, { name })}
                  onChangeColor={(columnId, color) => void updateColumn(columnId, { color })}
                  onDuplicate={(columnId) => void duplicateColumn(columnId)}
                  onDelete={setColumnToDelete}
                />
              ))}
            </SortableContext>

            {canEdit && <AddColumnButton />}
          </div>
        </div>

        <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }}>
          {activeTask ? <TaskCardPreview task={activeTask} /> : null}
        </DragOverlay>
      </DndContext>

      <DeleteColumnDialog
        column={columnToDelete}
        columns={columns}
        onClose={() => setColumnToDelete(null)}
        onConfirm={async (options) => {
          if (!columnToDelete) return;
          await deleteColumn(columnToDelete.id, options);
        }}
      />
    </>
  );
}
