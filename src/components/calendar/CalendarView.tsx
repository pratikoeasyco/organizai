"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { useBoard } from "@/components/kanban/BoardProvider";
import { CalendarChip, CalendarChipPreview } from "@/components/calendar/CalendarChip";
import { DayPanel } from "@/components/calendar/DayPanel";
import { matchesFilters } from "@/lib/board-filters";
import {
  WEEKDAY_LABELS,
  addMonths,
  buildMonthGrid,
  dayKey,
  groupTasksByDay,
  monthLabel,
} from "@/lib/calendar";
import type { BoardFilters } from "@/components/kanban/BoardToolbar";
import type { CalendarEvent } from "@/types/domain";

const MAX_VISIBLE_PER_DAY = 3;

function DayCell({
  day,
  tasks,
  doneIds,
  canEdit,
  onOpenDay,
  onOpenTask,
  onToggleDone,
  onCreate,
}: {
  day: ReturnType<typeof buildMonthGrid>[number];
  tasks: CalendarEvent[];
  doneIds: Set<string>;
  canEdit: boolean;
  onOpenDay: (date: Date) => void;
  onOpenTask: (taskId: string) => void;
  onToggleDone: (task: CalendarEvent) => void;
  onCreate: (date: Date) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${day.key}`,
    data: { type: "day", dayKey: day.key },
  });

  const visible = tasks.slice(0, MAX_VISIBLE_PER_DAY);
  const hidden = tasks.length - visible.length;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group/day flex min-h-[104px] flex-col border-b border-r border-line p-1.5 transition-colors",
        !day.inMonth && "bg-surface-muted/60",
        day.isWeekend && day.inMonth && "bg-surface-muted/40",
        isOver && "bg-brand-50 ring-1 ring-inset ring-brand-400",
      )}
    >
      <div className="mb-1 flex items-center justify-between">
        {/* Clicar no número abre o dia inteiro — é o "zoom" do dia. */}
        <button
          type="button"
          onClick={() => onOpenDay(day.date)}
          aria-label={`Ver o dia ${day.date.getDate()} por inteiro`}
          className={cn(
            "flex size-5 items-center justify-center rounded-full text-[11.5px] font-medium tabular-nums transition-colors",
            day.isToday && "bg-brand-600 font-semibold text-white hover:bg-brand-700",
            !day.isToday && day.inMonth && "text-ink-soft hover:bg-surface-sunken hover:text-ink",
            !day.isToday && !day.inMonth && "text-ink-faint hover:bg-surface-sunken",
          )}
        >
          {day.date.getDate()}
        </button>

        {canEdit && (
          <button
            type="button"
            onClick={() => onCreate(day.date)}
            aria-label={`Novo compromisso em ${day.date.getDate()}`}
            className="rounded-sm p-0.5 text-ink-faint opacity-0 transition-opacity hover:bg-surface-sunken hover:text-brand-600 focus-visible:opacity-100 group-hover/day:opacity-100"
          >
            <Plus className="size-3.5" />
          </button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-0.5">
        {visible.map((task) => (
          <CalendarChip
            key={task.id}
            task={task}
            done={doneIds.has(task.id)}
            canEdit={canEdit}
            onOpen={onOpenTask}
            onToggleDone={onToggleDone}
          />
        ))}

        {hidden > 0 && (
          // Antes isso expandia a célula, que estourava o layout num dia cheio.
          // Agora abre o dia inteiro, onde o espaço é adequado.
          <button
            type="button"
            onClick={() => onOpenDay(day.date)}
            className="rounded-sm px-1.5 py-0.5 text-left text-[10.5px] font-medium text-ink-muted transition-colors hover:bg-surface-sunken hover:text-brand-600"
          >
            +{hidden} {hidden === 1 ? "compromisso" : "compromissos"}
          </button>
        )}

        {/* Área livre do dia também abre o detalhe: alvo de clique generoso. */}
        <button
          type="button"
          onClick={() => onOpenDay(day.date)}
          aria-label={`Ver o dia ${day.date.getDate()} por inteiro`}
          tabIndex={-1}
          className="min-h-[14px] flex-1 rounded-sm"
        />
      </div>
    </div>
  );
}

export interface CalendarViewProps {
  filters: BoardFilters;
  onOpenTask: (taskId: string) => void;
  onCreateOnDay: (date: Date) => void;
}

export function CalendarView({ filters, onOpenTask, onCreateOnDay }: CalendarViewProps) {
  const board = useBoard();
  const [month, setMonth] = useState(() => new Date());
  const [openDay, setOpenDay] = useState<Date | null>(null);
  const [dragging, setDragging] = useState<CalendarEvent | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // O calendário lê apenas os compromissos. Tarefas do quadro nunca aparecem
  // aqui — são conjuntos separados de propósito.
  const events = board.events;

  const doneIds = useMemo(
    () => new Set(events.filter((event) => event.completedAt).map((event) => event.id)),
    [events],
  );

  const visibleEvents = useMemo(
    () => events.filter((event) => matchesFilters(event, filters)),
    [events, filters],
  );

  const byDay = useMemo(() => groupTasksByDay(visibleEvents), [visibleEvents]);
  const grid = useMemo(() => buildMonthGrid(month), [month]);

  async function handleDragEnd(event: DragEndEvent) {
    setDragging(null);
    const { active, over } = event;
    if (!over) return;

    const targetKey = over.data.current?.dayKey as string | undefined;
    if (!targetKey) return;

    const item = events.find((entry) => entry.id === active.id);
    if (!item || !item.dueDate) return;
    if (dayKey(new Date(item.dueDate)) === targetKey) return;

    await board.rescheduleEvent(item.id, targetKey);
  }

  function handleToggleDone(item: CalendarEvent) {
    void board.setEventDone(item.id, !doneIds.has(item.id));
  }

  return (
    <div className="flex h-full flex-col px-5 pb-5 sm:px-6">
      {/* Navegação do mês */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Mês anterior"
            onClick={() => setMonth((m) => addMonths(m, -1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Próximo mês"
            onClick={() => setMonth((m) => addMonths(m, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <h2 className="text-[15px] font-semibold capitalize tracking-tight text-ink">
          {monthLabel(month)}
        </h2>

        <Button variant="secondary" size="sm" onClick={() => setMonth(new Date())}>
          Hoje
        </Button>

        <span className="ml-auto flex items-center gap-1.5 text-[12px] text-ink-muted">
          <CalendarDays className="size-3.5 text-ink-faint" />
          {visibleEvents.length}{" "}
          {visibleEvents.length === 1 ? "compromisso" : "compromissos"}
        </span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={(event: DragStartEvent) =>
          setDragging(events.find((item) => item.id === event.active.id) ?? null)
        }
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDragging(null)}
      >
        <div className="min-h-0 flex-1 overflow-auto scrollbar-slim rounded-xl border border-line bg-surface">
          {/* Cabeçalho dos dias da semana */}
          <div className="sticky top-0 z-10 grid grid-cols-7 border-b border-line bg-surface">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="border-r border-line px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-ink-faint last:border-r-0"
              >
                {label}
              </div>
            ))}
          </div>

          {/* Grade do mês */}
          <div className="grid grid-cols-7 [&>*:nth-child(7n)]:border-r-0">
            {grid.map((day) => (
              <DayCell
                key={day.key}
                day={day}
                tasks={byDay.get(day.key) ?? []}
                doneIds={doneIds}
                canEdit={board.canEdit}
                onOpenDay={setOpenDay}
                onOpenTask={onOpenTask}
                onToggleDone={handleToggleDone}
                onCreate={onCreateOnDay}
              />
            ))}
          </div>
        </div>

        <DragOverlay dropAnimation={{ duration: 160, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }}>
          {dragging ? <CalendarChipPreview task={dragging} /> : null}
        </DragOverlay>
      </DndContext>

      <DayPanel
        date={openDay}
        onClose={() => setOpenDay(null)}
        onChangeDay={(next) => {
          setOpenDay(next);
          // Navegar para outro mês pelo painel move a grade junto, para o
          // usuário não voltar e se perder.
          if (next.getMonth() !== month.getMonth() || next.getFullYear() !== month.getFullYear()) {
            setMonth(new Date(next.getFullYear(), next.getMonth(), 1));
          }
        }}
        onOpenEvent={(id) => {
          setOpenDay(null);
          onOpenTask(id);
        }}
        onCreate={(date) => {
          setOpenDay(null);
          onCreateOnDay(date);
        }}
      />
    </div>
  );
}
