"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
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
import { useToast } from "@/components/ui/Toast";
import { KanbanColumn } from "@/components/kanban/KanbanColumn";
import { TaskCardPreview } from "@/components/kanban/TaskCard";
import { DeleteColumnDialog } from "@/components/kanban/DeleteColumnDialog";
import { AddColumnButton } from "@/components/kanban/AddColumnButton";
import { matchesFilters } from "@/lib/board-filters";
import { clampToPriorityBlock, sortColumnTasks } from "@/lib/utils/board-order";
import { PRIORITY_META } from "@/types/domain";
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
  const toast = useToast();
  const [preview, setPreview] = useState<BoardColumnData[] | null>(null);
  const [activeTask, setActiveTask] = useState<BoardTask | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [columnToDelete, setColumnToDelete] = useState<BoardColumnData | null>(null);

  /**
   * Mouse e toque precisam de sensores separados.
   *
   * Com um PointerSensor único, no celular o navegador tratava o gesto como
   * rolagem e cancelava o arraste antes de começar — arrastar simplesmente não
   * funcionava. Impedir a rolagem no card (`touch-action: none`) resolveria o
   * arraste e quebraria a rolagem da coluna e do quadro, que é pior.
   *
   * A saída é o toque longo: por 220ms o gesto ainda é rolagem; passando disso,
   * vira arraste e o dnd-kit assume o controle. `tolerance` permite o tremor
   * natural do dedo sem cancelar.
   */
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /**
   * A ordem exibida.
   *
   * O servidor manda cada coluna já ordenada, mas o quadro muda sozinho depois
   * disso: criar uma tarefa, trocar a prioridade no painel ou receber a
   * alteração de outra pessoa mexem na lista sem passar pelo servidor de novo.
   * Sem reordenar aqui, o card ficava onde entrou até alguém recarregar a
   * página — era possível ver uma Moderada acima de uma Urgente.
   *
   * Durante o arraste vale o `preview`: ali a ordem é a que a pessoa está
   * construindo com o dedo, e reordenar no meio do gesto puxaria o card da
   * mão. A prioridade nova é aplicada ao soltar, e a ordem se acerta em seguida.
   */
  const view = useMemo(() => {
    if (preview) return preview;
    return columns.map((column, index) => ({
      ...column,
      tasks: sortColumnTasks(column.tasks, columns.length > 1 && index === columns.length - 1),
    }));
  }, [preview, columns]);

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

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over || active.data.current?.type !== "task") return;

      const activeId = String(active.id);
      const overId = String(over.id);

      setPreview((current) => {
        if (!current) return current;

        const from = findColumnByTask(current, activeId);
        if (!from) return current;

        const arrastado = from.tasks.find((task) => task.id === activeId);

        /** O preview mostra o card já no bloco onde ele de fato vai parar. */
        const posicaoPermitida = (coluna: BoardColumnData, indice: number) => {
          if (!arrastado) return indice;
          return clampToPriorityBlock(
            coluna.tasks.filter((task) => task.id !== activeId),
            indice,
            arrastado.priority,
            coluna.id === doneColumnId,
          );
        };

        // Soltou sobre a área vazia de uma coluna.
        if (overId.startsWith("column-drop-")) {
          const toColumnId = overId.replace("column-drop-", "");
          if (from.id === toColumnId) return current;
          const target = current.find((column) => column.id === toColumnId);
          if (!target) return current;
          return relocate(
            current,
            activeId,
            toColumnId,
            posicaoPermitida(target, target.tasks.length),
          );
        }

        // Soltou sobre outro card.
        const overColumn = findColumnByTask(current, overId);
        if (!overColumn || overColumn.id === from.id) return current;

        const overIndex = overColumn.tasks.findIndex((task) => task.id === overId);
        return relocate(
          current,
          activeId,
          overColumn.id,
          posicaoPermitida(overColumn, Math.max(overIndex, 0)),
        );
      });
    },
    [doneColumnId],
  );

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

      const pedido = Math.max(toIndex, 0);

      /**
       * O card não entra em bloco de outra prioridade.
       *
       * A coluna é ordenada por prioridade, então soltar uma moderada no meio
       * das urgentes só criaria uma ordem que a próxima renderização desfaria.
       * Em vez de aceitar e corrigir depois, a posição é presa ao bloco certo —
       * e o aviso explica, porque um card que "não vai" onde foi solto precisa
       * dizer o motivo.
       *
       * Mudar de prioridade continua possível: no campo Prioridade do painel.
       */
      const destino = current.find((column) => column.id === toColumnId);
      const movedTask = current.flatMap((c) => c.tasks).find((t) => t.id === activeId);

      let finalIndex = pedido;
      if (destino && movedTask) {
        const semEle = destino.tasks.filter((t) => t.id !== activeId);
        finalIndex = clampToPriorityBlock(
          semEle,
          pedido,
          movedTask.priority,
          toColumnId === doneColumnId,
        );

        if (finalIndex !== pedido) {
          toast.info(
            `Esta tarefa fica entre as de prioridade ${PRIORITY_META[movedTask.priority].label.toLowerCase()}.`,
            "Para mudar isso, abra a tarefa e use o campo Prioridade.",
          );
        }
      }

      const unchanged =
        original?.id === toColumnId && originalIndex === finalIndex && originalIndex !== -1;
      if (unchanged) return;

      void moveTask(activeId, toColumnId, finalIndex);
    },
    [columns, preview, moveTask, reorderColumns, doneColumnId, toast],
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
