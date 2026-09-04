"use client";

import { useDraggable } from "@dnd-kit/core";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { formatTime } from "@/lib/utils/format";
import { PRIORITY_META, type CalendarEvent } from "@/types/domain";

export interface CalendarChipProps {
  task: CalendarEvent;
  done: boolean;
  canEdit: boolean;
  onOpen: (taskId: string) => void;
  onToggleDone: (task: CalendarEvent) => void;
}

/** Cor da barra lateral do chip: prioridade enquanto aberta, verde ao concluir. */
function accentFor(task: CalendarEvent, done: boolean): string {
  if (done) return "#10B981";
  return PRIORITY_META[task.priority].dot;
}

export function CalendarChip({ task, done, canEdit, onOpen, onToggleDone }: CalendarChipProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { type: "calendar-task" },
    disabled: !canEdit,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      onClick={(event) => {
        event.stopPropagation();
        onOpen(task.id);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(task.id);
        }
      }}
      aria-label={
        done
          ? `Concluída: ${task.title}`
          : `${task.hasTime ? `${formatTime(task.dueDate!)} ` : ""}${task.title}, prioridade ${
              PRIORITY_META[task.priority].label
            }`
      }
      className={cn(
        "group/chip flex w-full items-center gap-1 rounded border border-transparent bg-surface-muted py-0.5 pl-1.5 pr-0.5 text-left",
        "transition-colors hover:bg-surface-sunken",
        canEdit && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
    >
      <span
        aria-hidden="true"
        style={{ backgroundColor: accentFor(task, done) }}
        className="h-3 w-[3px] shrink-0 rounded-full"
      />

      {task.hasTime && task.dueDate && (
        <span
          className={cn(
            "shrink-0 text-[10px] font-semibold tabular-nums",
            done ? "text-ink-faint" : "text-ink-soft",
          )}
        >
          {formatTime(task.dueDate)}
        </span>
      )}

      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[11px] leading-tight",
          done ? "text-ink-faint line-through" : "text-ink-soft",
        )}
      >
        {task.title}
      </span>

      {canEdit && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleDone(task);
          }}
          onPointerDown={(event) => event.stopPropagation()}
          aria-label={done ? `Reabrir ${task.title}` : `Marcar ${task.title} como concluída`}
          aria-pressed={done}
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
            done
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-line-strong bg-surface text-transparent opacity-0 hover:border-emerald-500 hover:text-emerald-600 focus-visible:opacity-100 group-hover/chip:opacity-100",
          )}
        >
          <Check className="size-2.5" strokeWidth={3.5} />
        </button>
      )}
    </div>
  );
}

/** Chip mostrado no cursor durante o arraste. */
export function CalendarChipPreview({ task }: { task: CalendarEvent }) {
  return (
    <div className="flex w-[180px] items-center gap-1.5 rounded border border-brand-300 bg-surface px-2 py-1 shadow-pop">
      <span
        aria-hidden="true"
        style={{ backgroundColor: PRIORITY_META[task.priority].dot }}
        className="h-3 w-[3px] shrink-0 rounded-full"
      />
      <span className="truncate text-[11px] font-medium text-ink">{task.title}</span>
    </div>
  );
}
