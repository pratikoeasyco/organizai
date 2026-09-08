"use client";

import { Fragment, useEffect, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CheckCircle2, GripVertical, Plus } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { withAlpha } from "@/lib/utils/colors";
import { ColumnMenu } from "@/components/kanban/ColumnMenu";
import { TaskCard } from "@/components/kanban/TaskCard";
import { Tooltip } from "@/components/ui/Tooltip";
import { PRIORITY_META } from "@/types/domain";
import type { BoardColumnData, BoardTask } from "@/types/domain";

/**
 * A divisória aparece no primeiro card de cada bloco de prioridade — e só
 * quando a coluna tem mais de uma prioridade, senão vira ruído repetindo o
 * óbvio. Na coluna de concluído não aparece: ali a prioridade não vale mais.
 */
function mostrarDivisoria(tasks: BoardTask[], index: number, isDoneColumn: boolean): boolean {
  if (isDoneColumn) return false;
  if (tasks.length < 2) return false;
  const variasPrioridades = tasks.some((t) => t.priority !== tasks[0].priority);
  if (!variasPrioridades) return false;
  return index === 0 || tasks[index - 1].priority !== tasks[index].priority;
}

export interface KanbanColumnProps {
  column: BoardColumnData;
  tasks: BoardTask[];
  /** Total antes dos filtros — mostra quando há tarefas ocultas. */
  totalTasks: number;
  canEdit: boolean;
  /** Última coluna do quadro: tudo que chega aqui conta como concluído. */
  isDoneColumn: boolean;
  onOpenTask: (taskId: string) => void;
  onCreateTask: (column: BoardColumnData) => void;
  onRename: (columnId: string, name: string) => void;
  onChangeColor: (columnId: string, color: string) => void;
  onDuplicate: (columnId: string) => void;
  onDelete: (column: BoardColumnData) => void;
}

export function KanbanColumn({
  column,
  tasks,
  totalTasks,
  canEdit,
  isDoneColumn,
  onOpenTask,
  onCreateTask,
  onRename,
  onChangeColor,
  onDuplicate,
  onDelete,
}: KanbanColumnProps) {
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(column.name);

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id, data: { type: "column" }, disabled: !canEdit });

  // Área de soltura própria: permite largar em coluna vazia.
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `column-drop-${column.id}`,
    data: { type: "column-drop", columnId: column.id },
  });

  useEffect(() => setNameDraft(column.name), [column.name]);

  function commitRename() {
    const next = nameDraft.trim();
    setRenaming(false);
    if (next && next !== column.name) onRename(column.id, next);
    else setNameDraft(column.name);
  }

  const hidden = totalTasks - tasks.length;

  return (
    <section
      ref={setSortableRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      aria-label={`Coluna ${column.name}`}
      className={cn(
        // No celular a coluna não ocupa a tela toda de propósito: a próxima fica
        // espiando na borda. Sem esse pedaço visível não há para onde arrastar,
        // porque o destino está fora da tela.
        "flex h-full w-[84vw] max-w-[292px] shrink-0 flex-col rounded-xl border bg-surface-muted sm:w-[292px]",
        isDragging ? "border-brand-300 opacity-50" : "border-line",
        isOver && !isDragging && "border-brand-400 bg-brand-50/40",
      )}
    >
      {/* Cabeçalho */}
      <header className="flex items-center gap-1.5 px-2.5 py-2.5">
        {canEdit && (
          <button
            {...attributes}
            {...listeners}
            aria-label={`Reordenar coluna ${column.name}`}
            className="-ml-1 cursor-grab rounded-sm p-0.5 text-ink-faint opacity-0 transition-opacity hover:text-ink-soft focus-visible:opacity-100 active:cursor-grabbing group-hover/board:opacity-100"
          >
            <GripVertical className="size-3.5" />
          </button>
        )}

        {isDoneColumn ? (
          <Tooltip content="Tarefas nesta coluna contam como concluídas">
            <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
          </Tooltip>
        ) : (
          <span
            aria-hidden="true"
            style={{ backgroundColor: column.color }}
            className="size-2.5 shrink-0 rounded-full"
          />
        )}

        {renaming ? (
          <input
            autoFocus
            value={nameDraft}
            maxLength={40}
            onChange={(event) => setNameDraft(event.target.value)}
            onBlur={commitRename}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitRename();
              if (event.key === "Escape") {
                setNameDraft(column.name);
                setRenaming(false);
              }
            }}
            aria-label="Nome da coluna"
            className="min-w-0 flex-1 rounded-sm border border-brand-600 bg-surface px-1.5 py-0.5 text-[13px] font-semibold text-ink focus:outline-none"
          />
        ) : (
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => canEdit && setRenaming(true)}
            className="min-w-0 flex-1 truncate rounded-sm px-1 py-0.5 text-left text-[13px] font-semibold text-ink disabled:cursor-default"
            title={canEdit ? "Clique para renomear" : column.name}
          >
            {column.name}
          </button>
        )}

        <span
          className="shrink-0 rounded-full bg-surface px-1.5 py-0.5 text-[11px] font-medium text-ink-muted"
          title={hidden > 0 ? `${tasks.length} de ${totalTasks} visíveis` : undefined}
        >
          {hidden > 0 ? `${tasks.length}/${totalTasks}` : totalTasks}
        </span>

        {canEdit && (
          <ColumnMenu
            column={column}
            onRename={() => setRenaming(true)}
            onDuplicate={() => onDuplicate(column.id)}
            onDelete={() => onDelete(column)}
            onChangeColor={(color) => onChangeColor(column.id, color)}
          />
        )}
      </header>

      {/* Linha de cor da coluna */}
      <div
        aria-hidden="true"
        className="mx-2.5 h-0.5 rounded-full"
        style={{ backgroundColor: withAlpha(column.color, 0.45) }}
      />

      {/* Lista de tarefas */}
      <div
        ref={setDroppableRef}
        className="min-h-[60px] flex-1 space-y-2 overflow-y-auto scrollbar-slim px-2.5 py-2.5"
      >
        <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task, index) => (
            <Fragment key={task.id}>
              {mostrarDivisoria(tasks, index, isDoneColumn) && (
                // Explica por que o card parou aqui: a coluna é ordenada por
                // prioridade, e sem esta linha o card "pulando" de lugar ao ser
                // solto pareceria defeito em vez de regra.
                <p
                  className={cn(
                    "flex items-center gap-1.5 px-0.5 pt-1 text-[10.5px] font-semibold uppercase tracking-wide",
                    PRIORITY_META[task.priority].text,
                    index > 0 && "mt-1",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: PRIORITY_META[task.priority].dot }}
                  />
                  {PRIORITY_META[task.priority].label}
                </p>
              )}
              <TaskCard
                task={task}
                onOpen={onOpenTask}
                draggable={canEdit}
                done={isDoneColumn}
              />
            </Fragment>
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <p className="rounded-lg border border-dashed border-line px-3 py-5 text-center text-[12.5px] leading-relaxed text-ink-faint">
            {hidden > 0 ? "Nenhuma tarefa corresponde aos filtros." : "Nenhuma tarefa aqui."}
          </p>
        )}
      </div>

      {/* Criação de tarefa */}
      {canEdit && (
        <div className="px-2.5 pb-2.5">
          <button
            type="button"
            onClick={() => onCreateTask(column)}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium text-ink-muted transition-colors hover:bg-surface hover:text-brand-600"
          >
            <Plus className="size-4" />
            Adicionar tarefa
          </button>
        </div>
      )}
    </section>
  );
}
