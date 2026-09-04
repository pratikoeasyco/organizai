"use client";

import { useMemo, useState } from "react";
import { CalendarPlus, Check, ChevronLeft, ChevronRight, Clock, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { useBoard } from "@/components/kanban/BoardProvider";
import { dayKey, groupTasksByDay, isSameDay } from "@/lib/calendar";
import { formatDuration, formatFullDate, formatTimeRange } from "@/lib/utils/format";
import { PRIORITY_META, type CalendarEvent } from "@/types/domain";

export interface DayPanelProps {
  /** Dia aberto; `null` mantém o painel fechado. */
  date: Date | null;
  onClose: () => void;
  onChangeDay: (date: Date) => void;
  onOpenEvent: (eventId: string) => void;
  onCreate: (date: Date) => void;
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

/**
 * Detalhe de um dia — o "zoom" que o quadradinho do mês não comporta.
 * Mostra todos os compromissos, sem corte, e permite concluir, abrir e criar
 * sem sair do contexto do dia.
 */
export function DayPanel({ date, onClose, onChangeDay, onOpenEvent, onCreate }: DayPanelProps) {
  const board = useBoard();
  const [deleting, setDeleting] = useState<CalendarEvent | null>(null);

  const events = useMemo(() => {
    if (!date) return [];
    return groupTasksByDay(board.events).get(dayKey(date)) ?? [];
  }, [board.events, date]);

  if (!date) return null;

  const allDay = events.filter((event) => !event.hasTime);
  const timed = events.filter((event) => event.hasTime);
  const isToday = isSameDay(date, new Date());

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={formatFullDate(date)}
      description={
        events.length === 0
          ? "Nenhum compromisso neste dia."
          : `${events.length} ${events.length === 1 ? "compromisso" : "compromissos"}${
              timed.length > 0 ? ` · ${timed.length} com horário` : ""
            }`
      }
      footer={
        <>
          <div className="mr-auto flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Dia anterior"
              onClick={() => onChangeDay(addDays(date, -1))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Próximo dia"
              onClick={() => onChangeDay(addDays(date, 1))}
            >
              <ChevronRight className="size-4" />
            </Button>
            {!isToday && (
              <Button variant="ghost" size="sm" onClick={() => onChangeDay(new Date())}>
                Hoje
              </Button>
            )}
          </div>

          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
          {board.canEdit && (
            <Button
              variant="primary"
              leftIcon={<CalendarPlus className="size-4" />}
              onClick={() => onCreate(date)}
            >
              Novo compromisso
            </Button>
          )}
        </>
      }
    >
      {events.length === 0 ? (
        <EmptyState
          compact
          icon={<CalendarPlus />}
          title="Dia livre"
          description={
            board.canEdit
              ? "Nada agendado aqui. Use o botão abaixo para marcar algo."
              : "Nada agendado neste dia."
          }
        />
      ) : (
        <div className="space-y-4">
          {allDay.length > 0 && (
            <section>
              <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                Dia todo
              </h3>
              <ul className="space-y-1.5">
                {allDay.map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    onOpen={onOpenEvent}
                    onRequestDelete={setDeleting}
                    canEdit={board.canEdit}
                  />
                ))}
              </ul>
            </section>
          )}

          {timed.length > 0 && (
            <section>
              <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                Com horário
              </h3>
              <ul className="space-y-1.5">
                {timed.map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    onOpen={onOpenEvent}
                    onRequestDelete={setDeleting}
                    canEdit={board.canEdit}
                  />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {/* Confirmação empilhada sobre o painel do dia — a pilha de overlays
          garante que o Esc feche só esta, não as duas. */}
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) await board.deleteEvent(deleting.id);
        }}
        title="Excluir este compromisso?"
        description={
          <>
            <strong className="font-medium text-ink">{deleting?.title}</strong> será removido
            permanentemente, junto com a pauta e os comentários. Essa ação não poderá ser
            desfeita.
          </>
        }
        confirmLabel="Excluir compromisso"
      />
    </Modal>
  );
}

// ---------------------------------------------------------------------------

function EventRow({
  event,
  onOpen,
  onRequestDelete,
  canEdit,
}: {
  event: CalendarEvent;
  onOpen: (id: string) => void;
  onRequestDelete: (event: CalendarEvent) => void;
  canEdit: boolean;
}) {
  const board = useBoard();
  const done = Boolean(event.completedAt);
  const priority = PRIORITY_META[event.priority];

  return (
    <li className="group flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5 transition-colors hover:border-line-strong">
      {canEdit && (
        <button
          type="button"
          onClick={() => void board.setEventDone(event.id, !done)}
          aria-label={done ? `Reabrir ${event.title}` : `Concluir ${event.title}`}
          aria-pressed={done}
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
            done
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-line-strong text-transparent hover:border-emerald-500 hover:text-emerald-500",
          )}
        >
          <Check className="size-3" strokeWidth={3.5} />
        </button>
      )}

      <button
        type="button"
        onClick={() => onOpen(event.id)}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span className="w-[104px] shrink-0">
          {event.hasTime && event.dueDate ? (
            <>
              <span
                className={cn(
                  "block text-[12.5px] font-semibold tabular-nums",
                  done ? "text-ink-faint" : "text-ink",
                )}
              >
                {formatTimeRange(event.dueDate, event.durationMinutes)}
              </span>
              {event.durationMinutes && (
                <span className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-faint">
                  <Clock className="size-2.5" />
                  {formatDuration(event.durationMinutes)}
                </span>
              )}
            </>
          ) : (
            <span className="text-[12px] text-ink-faint">Dia todo</span>
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "flex items-center gap-1.5 text-[13.5px] font-medium",
              done ? "text-ink-faint line-through" : "text-ink",
            )}
          >
            {!done && event.priority !== "LOW" && (
              <span
                aria-hidden="true"
                style={{ backgroundColor: priority.dot }}
                className="size-2 shrink-0 rounded-full"
                title={priority.label}
              />
            )}
            <span className="truncate">{event.title}</span>
          </span>

          {event.description && (
            <span className="mt-0.5 block truncate text-[12px] text-ink-muted">
              {event.description}
            </span>
          )}
        </span>

        {event.assignee && (
          <Avatar
            name={event.assignee.name}
            color={event.assignee.avatarColor}
            size="xs"
            title={`Responsável: ${event.assignee.name}`}
          />
        )}
      </button>

      {canEdit && (
        <button
          type="button"
          onClick={() => onRequestDelete(event)}
          aria-label={`Excluir ${event.title}`}
          className="shrink-0 rounded-sm p-1.5 text-ink-faint opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </li>
  );
}
