"use client";

import { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlignLeft,
  ArrowRightLeft,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  Clock,
  MessageSquare,
  Paperclip,
} from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { Avatar } from "@/components/ui/Avatar";
import {
  formatDueLabel,
  formatRelative,
  formatTime,
  formatTimeRange,
  getDueStatus,
  getFirstName,
} from "@/lib/utils/format";
import { withAlpha } from "@/lib/utils/colors";
import { PRIORITY_META, type BoardTask } from "@/types/domain";

export interface TaskCardProps {
  task: BoardTask;
  onOpen: (taskId: string) => void;
  draggable: boolean;
  /**
   * A tarefa está na última coluna do quadro. Nesse ponto ela é tratada como
   * concluída: a prioridade deixa de importar e o card fica neutro com um check.
   */
  done: boolean;
}

const DUE_CLASSES: Record<string, string> = {
  overdue: "bg-red-50 text-red-700",
  today: "bg-amber-50 text-amber-700",
  soon: "bg-surface-sunken text-ink-soft",
  future: "bg-surface-sunken text-ink-muted",
};

function TaskCardBase({ task, onOpen, draggable, done }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", columnId: task.columnId },
    disabled: !draggable,
  });

  const priority = PRIORITY_META[task.priority];
  const dueStatus = getDueStatus(task.dueDate);
  const hasChecklist = task.checklistTotal > 0;
  const checklistComplete = hasChecklist && task.checklistDone === task.checklistTotal;
  const hasDescription = Boolean(task.description && task.description.trim().length > 0);

  // A borda só carrega prioridade enquanto a tarefa não está concluída.
  // "Baixa" fica com a borda neutra padrão — só Moderada e Urgente se destacam.
  const borderClass = done ? "border-line hover:border-line-strong" : priority.cardBorder;

  // Cor é reforço, nunca o único sinal: Moderada/Urgente também mostram o rótulo.
  const showPriorityChip = !done && task.priority !== "LOW";

  const metaVisible =
    showPriorityChip ||
    Boolean(task.dueDate) ||
    hasDescription ||
    hasChecklist ||
    task.commentCount > 0 ||
    task.attachmentCount > 0 ||
    Boolean(task.assignee);

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(task.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(task.id);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={
        done
          ? `Abrir tarefa concluída ${task.title}`
          : `Abrir tarefa ${task.title}, prioridade ${priority.label}`
      }
      className={cn(
        "group relative rounded-lg border bg-surface p-3 text-left shadow-xs",
        "transition-[border-color,box-shadow,transform] duration-150 hover:shadow-sm",
        borderClass,
        draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        isDragging && "opacity-40",
      )}
    >
      {/* Etiquetas */}
      {task.labels.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {task.labels.slice(0, 3).map((label) => (
            <span
              key={label.id}
              style={{
                backgroundColor: withAlpha(label.color, 0.13),
                color: label.color,
              }}
              className="rounded px-1.5 py-0.5 text-[10.5px] font-medium leading-tight"
            >
              {label.name}
            </span>
          ))}
          {task.labels.length > 3 && (
            <span className="rounded bg-surface-sunken px-1.5 py-0.5 text-[10.5px] font-medium leading-tight text-ink-muted">
              +{task.labels.length - 3}
            </span>
          )}
        </div>
      )}

      <div className="flex items-start gap-1.5">
        {done && (
          <CheckCircle2
            className="mt-px size-3.5 shrink-0 text-emerald-600"
            aria-label="Concluída"
          />
        )}
        <h4
          className={cn(
            "min-w-0 flex-1 text-[13.5px] font-medium leading-snug",
            done ? "text-ink-muted" : "text-ink",
          )}
        >
          {task.title}
        </h4>
      </div>

      {metaVisible && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          {showPriorityChip && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] font-medium",
                priority.bg,
                priority.text,
              )}
            >
              <span
                aria-hidden="true"
                style={{ backgroundColor: priority.dot }}
                className="size-1.5 rounded-full"
              />
              {priority.label}
            </span>
          )}

          {task.dueDate && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] font-medium",
                done ? "bg-surface-sunken text-ink-muted" : DUE_CLASSES[dueStatus],
              )}
              title={
                task.hasTime
                  ? `${formatDueLabel(task.dueDate)}, ${formatTimeRange(task.dueDate, task.durationMinutes)}`
                  : `Prazo: ${formatDueLabel(task.dueDate)}`
              }
            >
              {task.hasTime ? (
                <Clock className="size-3" aria-hidden="true" />
              ) : (
                <CalendarDays className="size-3" aria-hidden="true" />
              )}
              {formatDueLabel(task.dueDate)}
              {task.hasTime && ` · ${formatTime(task.dueDate)}`}
            </span>
          )}

          {hasDescription && (
            <AlignLeft
              className="size-3.5 text-ink-faint"
              aria-label="Esta tarefa tem descrição"
            />
          )}

          {hasChecklist && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[10.5px] font-medium",
                checklistComplete ? "text-emerald-600" : "text-ink-muted",
              )}
              title={`Checklist: ${task.checklistDone} de ${task.checklistTotal}`}
            >
              <CheckSquare className="size-3" aria-hidden="true" />
              {task.checklistDone}/{task.checklistTotal}
            </span>
          )}

          {task.commentCount > 0 && (
            <span
              className="inline-flex items-center gap-1 text-[10.5px] font-medium text-ink-muted"
              title={`${task.commentCount} comentário(s)`}
            >
              <MessageSquare className="size-3" aria-hidden="true" />
              {task.commentCount}
            </span>
          )}

          {task.attachmentCount > 0 && (
            <span
              className="inline-flex items-center gap-1 text-[10.5px] font-medium text-ink-muted"
              title={`${task.attachmentCount} anexo(s)`}
            >
              <Paperclip className="size-3" aria-hidden="true" />
              {task.attachmentCount}
            </span>
          )}

          {task.assignee && (
            <span className="ml-auto">
              <Avatar
                name={task.assignee.name}
                color={task.assignee.avatarColor}
                size="xs"
                title={`Responsável: ${task.assignee.name}`}
              />
            </span>
          )}
        </div>
      )}

      {/* Autoria da última movimentação. Fica numa linha própria para não
          competir com o avatar do responsável, que também vai à direita. */}
      {task.lastMovedBy && (
        <p
          className="mt-2 flex items-center justify-end gap-1 text-[10px] text-ink-faint"
          title={
            task.lastMovedAt
              ? `Movido por ${task.lastMovedBy.name} · ${formatRelative(task.lastMovedAt)}`
              : `Movido por ${task.lastMovedBy.name}`
          }
        >
          <ArrowRightLeft className="size-2.5 shrink-0" aria-hidden="true" />
          <span className="truncate">
            movido por {getFirstName(task.lastMovedBy.name)}
            {task.lastMovedAt && ` · ${formatRelative(task.lastMovedAt)}`}
          </span>
        </p>
      )}
    </article>
  );
}

export const TaskCard = memo(TaskCardBase);

/** Versão estática usada no overlay de arraste. */
export function TaskCardPreview({ task }: { task: BoardTask }) {
  return (
    <div
      className={cn(
        "w-[272px] rotate-2 rounded-lg border bg-surface p-3 shadow-pop",
        PRIORITY_META[task.priority].cardBorder,
      )}
    >
      <h4 className="text-[13.5px] font-medium leading-snug text-ink">{task.title}</h4>
    </div>
  );
}
