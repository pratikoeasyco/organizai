"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { AssigneePicker } from "@/components/kanban/AssigneePicker";
import { Input, Textarea } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { formatDuration } from "@/lib/utils/format";
import { Modal } from "@/components/ui/Modal";
import { PriorityPicker } from "@/components/kanban/PriorityPicker";
import { useBoard } from "@/components/kanban/BoardProvider";
import { DEFAULT_PRIORITY, type Priority } from "@/types/domain";

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

/** 0 significa "não avisar antes" — o aviso de início continua saindo. */
const REMINDER_OPTIONS = [
  { value: "0", label: "Não avisar antes" },
  { value: "5", label: "5 minutos antes" },
  { value: "10", label: "10 minutos antes" },
  { value: "15", label: "15 minutos antes" },
  { value: "30", label: "30 minutos antes" },
  { value: "60", label: "1 hora antes" },
  { value: "120", label: "2 horas antes" },
  { value: "1440", label: "1 dia antes" },
];

export interface CreateTaskModalProps {
  /**
   * `column` abre no modo tarefa (vai para o quadro).
   * `eventDate` abre no modo compromisso (vai para o calendário).
   * Ambos nulos mantêm o modal fechado.
   */
  column: { id: string; name: string } | null;
  eventDate: string | null;
  onClose: () => void;
}

export function CreateTaskModal({ column, eventDate, onClose }: CreateTaskModalProps) {
  const { createTask, createEvent, members, currentUserId } = useBoard();
  const isEvent = eventDate !== null;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>(DEFAULT_PRIORITY);
  const [assigneeId, setAssigneeId] = useState<string | null>(currentUserId);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState(60);
  const [reminder, setReminder] = useState(60);
  const [busy, setBusy] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const open = isEvent || column !== null;

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setPriority(DEFAULT_PRIORITY);
    // A maior parte do que você cria é sua: começa atribuído a você.
    setAssigneeId(currentUserId);
    setDate(eventDate ?? "");
    setTime("");
    setDuration(60);
    setReminder(60);
    setBusy(false);
  }, [open, eventDate, column, currentUserId]);

  if (!open) return null;

  async function submit(keepOpen: boolean) {
    const trimmed = title.trim();
    if (!trimmed) return;

    setBusy(true);
    let ok = false;

    if (isEvent) {
      const hasTime = Boolean(time);
      ok = await createEvent({
        title: trimmed,
        description: description.trim() || null,
        priority,
        dueDate: hasTime ? `${date}T${time}` : date,
        hasTime,
        durationMinutes: hasTime ? duration : null,
        assigneeId,
        reminderMinutes: hasTime && reminder > 0 ? reminder : null,
      });
    } else if (column) {
      ok = await createTask(column.id, {
        title: trimmed,
        description: description.trim() || null,
        priority,
        dueDate: date || null,
        assigneeId,
      });
    }

    setBusy(false);
    if (!ok) return;

    if (keepOpen) {
      // Entrada em sequência: limpa o texto mas mantém data e prioridade — quem
      // cadastra vários compromissos do mesmo dia não quer redigitar isso.
      setTitle("");
      setDescription("");
      titleRef.current?.focus();
    } else {
      onClose();
    }
  }

  const canSubmit = title.trim().length > 0 && !busy && (!isEvent || date.length > 0);

  return (
    <Modal
      open
      onClose={onClose}
      busy={busy}
      title={isEvent ? "Novo compromisso" : "Nova tarefa"}
      description={
        isEvent
          ? "Compromissos vivem no calendário e não aparecem no quadro."
          : `Vai para a coluna "${column?.name}" do quadro e não aparece no calendário.`
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="secondary" onClick={() => void submit(true)} disabled={!canSubmit}>
            Salvar e criar outro
          </Button>
          <Button
            variant="primary"
            onClick={() => void submit(false)}
            loading={busy}
            disabled={!canSubmit}
          >
            {isEvent ? "Agendar" : "Criar tarefa"}
          </Button>
        </>
      }
    >
      <form
        className="space-y-5"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit(false);
        }}
      >
        <Input
          ref={titleRef}
          label="Título"
          placeholder={
            isEvent ? "Ex.: Reunião de alinhamento" : "Ex.: Criar landing page da campanha"
          }
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={200}
          required
          data-autofocus
        />

        <Textarea
          label={isEvent ? "Pauta / observações (opcional)" : "Descrição (opcional)"}
          placeholder={
            isEvent
              ? "Assuntos a tratar, link da chamada, participantes..."
              : "Detalhe o que precisa ser feito, links, critérios de aceite..."
          }
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void submit(false);
            }
          }}
          maxLength={5000}
          rows={4}
        />

        <PriorityPicker value={priority} onChange={setPriority} />

        {/* Responsável e prazo numa linha só: são opcionais e não podem
            competir visualmente com o título. */}
        <div className="grid gap-4 sm:grid-cols-2">
          <AssigneePicker
            value={assigneeId}
            onChange={setAssigneeId}
            members={members}
            currentUserId={currentUserId}
          />

          {!isEvent && (
            <div className="space-y-1.5">
              <label
                htmlFor="nova-tarefa-prazo"
                className="block text-[13px] font-medium text-ink-soft"
              >
                Prazo (opcional)
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  id="nova-tarefa-prazo"
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className="h-9.5 min-w-0 flex-1 rounded-md border border-line bg-surface px-2.5 text-[13.5px] text-ink transition-colors hover:border-line-strong focus:border-brand-600 focus:outline-none focus:ring-3 focus:ring-brand-600/12"
                />
                {date && (
                  <button
                    type="button"
                    onClick={() => setDate("")}
                    aria-label="Remover prazo"
                    className="rounded-sm p-1.5 text-ink-faint transition-colors hover:bg-surface-sunken hover:text-ink"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {isEvent && (
          <fieldset className="rounded-lg border border-line p-3.5">
            <legend className="px-1 text-[13px] font-medium text-ink-soft">Quando</legend>

            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] text-ink-muted">Dia</span>
                <input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  required
                  className="h-9 rounded-md border border-line bg-surface px-2.5 text-[13.5px] text-ink focus:border-brand-600 focus:outline-none focus:ring-3 focus:ring-brand-600/12"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] text-ink-muted">Hora</span>
                <input
                  type="time"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                  className="h-9 rounded-md border border-line bg-surface px-2.5 text-[13.5px] text-ink focus:border-brand-600 focus:outline-none focus:ring-3 focus:ring-brand-600/12"
                />
              </label>

              {time && (
                <span className="flex w-36 flex-col gap-1.5">
                  <span className="text-[12px] text-ink-muted">Duração</span>
                  <SelectField
                    aria-label="Duração do compromisso"
                    value={String(duration)}
                    onChange={(next) => setDuration(Number(next))}
                    options={DURATION_OPTIONS.map((minutes) => ({
                      value: String(minutes),
                      label: formatDuration(minutes),
                    }))}
                  />
                </span>
              )}
            </div>

            {time && (
              <div className="mt-3.5 border-t border-line pt-3">
                <SelectField
                  label="Avisar antes"
                  value={String(reminder)}
                  onChange={(next) => setReminder(Number(next))}
                  options={REMINDER_OPTIONS}
                  hint="Você e o time recebem uma notificação nesse momento — e outra na hora de começar."
                />
              </div>
            )}

            <p className="mt-2.5 text-[12px] leading-relaxed text-ink-muted">
              {time
                ? "Aparece como compromisso com horário no calendário."
                : "Sem hora, entra como compromisso do dia inteiro."}
            </p>
          </fieldset>
        )}
      </form>
    </Modal>
  );
}
