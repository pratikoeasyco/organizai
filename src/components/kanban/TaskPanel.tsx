"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlignLeft,
  CalendarDays,
  Check,
  CheckSquare,
  Flag,
  Loader2,
  MessageSquare,
  Plus,
  Tag,
  Trash2,
  User as UserIcon,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { api } from "@/lib/api-client";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { hasOpenOverlay } from "@/components/ui/modal-stack";
import { SelectField } from "@/components/ui/SelectField";
import { Dropdown, DropdownItem, DropdownLabel } from "@/components/ui/Dropdown";
import { useToast } from "@/components/ui/Toast";
import { useMounted } from "@/hooks/useMounted";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { useBoard } from "@/components/kanban/BoardProvider";
import {
  formatDate,
  formatDuration,
  formatRelative,
  formatTimeRange,
  toDateInputValue,
  toTimeInputValue,
} from "@/lib/utils/format";
import { withAlpha } from "@/lib/utils/colors";
import { PRIORITIES, PRIORITY_META, type Priority, type TaskDetail } from "@/types/domain";

interface FieldRowProps {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}

function FieldRow({ icon, label, children }: FieldRowProps) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="flex w-[104px] shrink-0 items-center gap-2 pt-1.5 text-[12.5px] text-ink-muted [&>svg]:size-3.5">
        {icon}
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export interface TaskPanelProps {
  taskId: string | null;
  onClose: () => void;
}

export function TaskPanel({ taskId, onClose }: TaskPanelProps) {
  const mounted = useMounted();
  const toast = useToast();
  const board = useBoard();
  const { canEdit, members, labels, syncDetail, removeTaskLocal, addLabel } = board;

  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletingItem, setDeletingItem] = useState<TaskDetail["checklist"][number] | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [savingField, setSavingField] = useState<string | null>(null);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [commentDraft, setCommentDraft] = useState("");

  useLockBodyScroll(Boolean(taskId));

  const load = useCallback(
    async (id: string) => {
      setLoading(true);
      try {
        const { task } = await api.get<{ task: TaskDetail }>(`/api/tasks/${id}`);
        setDetail(task);
        setTitle(task.title);
        setDescription(task.description ?? "");
      } catch (error) {
        toast.error(
          "Não foi possível abrir a tarefa.",
          error instanceof Error ? error.message : undefined,
        );
        onClose();
      } finally {
        setLoading(false);
      }
    },
    [toast, onClose],
  );

  useEffect(() => {
    if (!taskId) {
      setDetail(null);
      return;
    }
    void load(taskId);
  }, [taskId, load]);

  useEffect(() => {
    if (!taskId) return;
    function onKeyDown(event: KeyboardEvent) {
      // Com um modal aberto por cima (confirmação, por exemplo), o Esc é dele.
      if (event.key === "Escape" && !hasOpenOverlay()) onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [taskId, onClose]);

  /**
   * Persiste um campo e sincroniza a origem — quadro ou calendário, conforme
   * o tipo. Relê o detalhe depois de salvar: é uma ida a mais ao servidor, mas
   * o painel não é caminho quente e assim tarefa e compromisso seguem o mesmo
   * fluxo, sem duplicar a lógica de cada campo.
   */
  const patch = useCallback(
    async (field: string, body: Record<string, unknown>) => {
      if (!taskId) return;
      setSavingField(field);
      try {
        await api.patch(`/api/tasks/${taskId}`, body);
        const { task } = await api.get<{ task: TaskDetail }>(`/api/tasks/${taskId}`);
        setDetail(task);
        syncDetail(task);
      } catch (error) {
        toast.error(
          "Não foi possível salvar.",
          error instanceof Error ? error.message : undefined,
        );
        if (taskId) void load(taskId);
      } finally {
        setSavingField(null);
      }
    },
    [taskId, syncDetail, toast, load],
  );

  /**
   * Aplica um novo detalhe e sincroniza a lista de origem. Os dois `setState`
   * ficam fora de qualquer updater — atualizar outro componente de dentro de
   * um updater dispara aviso do React.
   */
  const commitDetail = useCallback(
    (next: TaskDetail) => {
      setDetail(next);
      syncDetail(next);
    },
    [syncDetail],
  );

  /** Recalcula os contadores derivados do checklist. */
  function withChecklist(current: TaskDetail, checklist: TaskDetail["checklist"]): TaskDetail {
    return {
      ...current,
      checklist,
      checklistTotal: checklist.length,
      checklistDone: checklist.filter((item) => item.done).length,
    };
  }

  async function handleAddChecklistItem() {
    const content = newChecklistItem.trim();
    if (!content || !taskId || !detail) return;
    try {
      const { item } = await api.post<{
        item: { id: string; content: string; done: boolean; position: number };
      }>(`/api/tasks/${taskId}/checklist`, { content });
      setNewChecklistItem("");
      commitDetail(withChecklist(detail, [...detail.checklist, item]));
    } catch (error) {
      toast.error(
        "Não foi possível adicionar o item.",
        error instanceof Error ? error.message : undefined,
      );
    }
  }

  async function toggleChecklistItem(itemId: string, done: boolean) {
    if (!detail) return;
    commitDetail(
      withChecklist(
        detail,
        detail.checklist.map((item) => (item.id === itemId ? { ...item, done } : item)),
      ),
    );

    try {
      await api.patch(`/api/checklist/${itemId}`, { done });
    } catch {
      toast.error("Não foi possível atualizar o item.");
      if (taskId) void load(taskId);
    }
  }

  async function removeChecklistItem(itemId: string) {
    if (!detail) return;
    commitDetail(
      withChecklist(
        detail,
        detail.checklist.filter((item) => item.id !== itemId),
      ),
    );

    try {
      await api.delete(`/api/checklist/${itemId}`);
    } catch {
      toast.error("Não foi possível remover o item.");
      if (taskId) void load(taskId);
    }
  }

  async function submitComment() {
    const body = commentDraft.trim();
    if (!body || !taskId || !detail) return;
    try {
      const { comment } = await api.post<{ comment: TaskDetail["comments"][number] }>(
        `/api/tasks/${taskId}/comments`,
        { body },
      );
      setCommentDraft("");
      commitDetail({
        ...detail,
        comments: [...detail.comments, comment],
        commentCount: detail.commentCount + 1,
      });
    } catch (error) {
      toast.error(
        "Não foi possível comentar.",
        error instanceof Error ? error.message : undefined,
      );
    }
  }

  async function handleDelete() {
    if (!taskId || !detail) return;
    if (detail.kind === "EVENT") {
      await board.deleteEvent(taskId);
    } else {
      await board.deleteTask(taskId);
      removeTaskLocal(taskId);
    }
    onClose();
  }

  async function handleCreateLabel(name: string) {
    try {
      const { label } = await api.post<{ label: { id: string; name: string; color: string } }>(
        "/api/labels",
        { projectId: board.project.id, name, color: "#2563EB" },
      );
      addLabel(label);
      const nextIds = [...(detail?.labels ?? []).map((item) => item.id), label.id];
      await patch("labels", { labelIds: nextIds });
    } catch (error) {
      toast.error(
        "Não foi possível criar a etiqueta.",
        error instanceof Error ? error.message : undefined,
      );
    }
  }

  if (!mounted || !taskId) return null;

  const selectedLabelIds = new Set((detail?.labels ?? []).map((label) => label.id));

  return createPortal(
    <div className="fixed inset-0 z-100 flex justify-end">
      <div
        className="absolute inset-0 bg-slate-900/25 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={detail?.title ?? "Detalhes da tarefa"}
        // No celular ocupa a tela inteira, então precisa recuar do relógio (topo)
        // e do indicador de início (base) — senão o cabeçalho e o último campo
        // ficam por baixo deles.
        className="relative flex h-full w-full max-w-[560px] flex-col border-l border-line bg-surface pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] shadow-pop animate-slide-left"
      >
        {/* Cabeçalho */}
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-2 text-[12.5px] text-ink-muted">
            <span
              aria-hidden="true"
              style={{ backgroundColor: board.project.color }}
              className="size-2 shrink-0 rounded-full"
            />
            <span className="truncate">{board.project.name}</span>
            {savingField && (
              <span className="flex shrink-0 items-center gap-1 text-ink-faint">
                <Loader2 className="size-3 animate-spin" />
                salvando
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {canEdit && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Excluir tarefa"
                onClick={() => setConfirmDelete(true)}
                className="hover:text-red-600"
              >
                <Trash2 className="size-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon-sm" aria-label="Fechar" onClick={onClose}>
              <X className="size-4" />
            </Button>
          </div>
        </header>

        {loading && !detail ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-ink-faint" />
          </div>
        ) : detail ? (
          <div className="flex-1 overflow-y-auto scrollbar-slim px-5 py-4">
            {/* Título */}
            <textarea
              value={title}
              disabled={!canEdit}
              rows={1}
              maxLength={200}
              onChange={(event) => {
                setTitle(event.target.value);
                event.target.style.height = "auto";
                event.target.style.height = `${event.target.scrollHeight}px`;
              }}
              onBlur={() => {
                const next = title.trim();
                if (next && next !== detail.title) void patch("title", { title: next });
                else setTitle(detail.title);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.blur();
                }
              }}
              aria-label="Título da tarefa"
              className="w-full resize-none rounded-md border border-transparent bg-transparent px-2 py-1 text-[19px] font-semibold leading-snug tracking-tight text-ink transition-colors hover:border-line focus:border-brand-600 focus:outline-none disabled:hover:border-transparent"
            />

            {/* Campos */}
            <div className="mt-3 divide-y divide-line border-y border-line">
              <FieldRow icon={<UserIcon />} label="Responsável">
                <Dropdown
                  width={230}
                  align="start"
                  trigger={({ ref, onClick, open, ...aria }) => (
                    <button
                      ref={ref}
                      onClick={onClick}
                      {...aria}
                      disabled={!canEdit}
                      data-open={open}
                      className="flex min-h-8 w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[13.5px] transition-colors hover:bg-surface-sunken disabled:pointer-events-none"
                    >
                      {detail.assignee ? (
                        <>
                          <Avatar
                            name={detail.assignee.name}
                            color={detail.assignee.avatarColor}
                            size="xs"
                          />
                          <span className="truncate text-ink">{detail.assignee.name}</span>
                        </>
                      ) : (
                        <span className="text-ink-faint">Não atribuída</span>
                      )}
                    </button>
                  )}
                >
                  {({ close }) => (
                    <>
                      <DropdownItem
                        onSelect={() => {
                          close();
                          void patch("assignee", { assigneeId: null });
                        }}
                        active={!detail.assignee}
                      >
                        Não atribuída
                      </DropdownItem>
                      {members.map((member) => (
                        <DropdownItem
                          key={member.id}
                          icon={
                            <Avatar name={member.name} color={member.avatarColor} size="xs" />
                          }
                          active={detail.assignee?.id === member.id}
                          onSelect={() => {
                            close();
                            void patch("assignee", { assigneeId: member.id });
                          }}
                        >
                          {member.name}
                        </DropdownItem>
                      ))}
                    </>
                  )}
                </Dropdown>
              </FieldRow>

              <FieldRow icon={<Flag />} label="Prioridade">
                <Dropdown
                  width={200}
                  align="start"
                  trigger={({ ref, onClick, open, ...aria }) => (
                    <button
                      ref={ref}
                      onClick={onClick}
                      {...aria}
                      disabled={!canEdit}
                      data-open={open}
                      className="flex min-h-8 w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[13.5px] transition-colors hover:bg-surface-sunken disabled:pointer-events-none"
                    >
                      <span
                        aria-hidden="true"
                        style={{ backgroundColor: PRIORITY_META[detail.priority].dot }}
                        className="size-2 shrink-0 rounded-full"
                      />
                      <span className="text-ink">{PRIORITY_META[detail.priority].label}</span>
                    </button>
                  )}
                >
                  {({ close }) => (
                    <>
                      {PRIORITIES.map((priority) => (
                        <DropdownItem
                          key={priority}
                          active={detail.priority === priority}
                          icon={
                            <span
                              aria-hidden="true"
                              style={{ backgroundColor: PRIORITY_META[priority].dot }}
                              className="size-2 rounded-full"
                            />
                          }
                          onSelect={() => {
                            close();
                            void patch("priority", { priority: priority as Priority });
                          }}
                        >
                          {PRIORITY_META[priority].label}
                        </DropdownItem>
                      ))}
                    </>
                  )}
                </Dropdown>
              </FieldRow>

              <FieldRow icon={<CalendarDays />} label="Quando">
                <div className="flex flex-wrap items-center gap-1.5 py-0.5">
                  <input
                    type="date"
                    disabled={!canEdit}
                    value={toDateInputValue(detail.dueDate)}
                    onChange={(event) =>
                      void patch("dueDate", { dueDate: event.target.value || "" })
                    }
                    aria-label="Data"
                    className="h-8 rounded-md border border-transparent bg-transparent px-2 text-[13.5px] text-ink transition-colors hover:border-line focus:border-brand-600 focus:outline-none disabled:pointer-events-none"
                  />

                  {detail.dueDate && (
                    <input
                      type="time"
                      disabled={!canEdit}
                      value={detail.hasTime ? toTimeInputValue(detail.dueDate) : ""}
                      onChange={(event) => {
                        const day = toDateInputValue(detail.dueDate);
                        if (!event.target.value) {
                          void patch("dueDate", { dueDate: day, hasTime: false });
                        } else {
                          void patch("dueDate", {
                            dueDate: `${day}T${event.target.value}`,
                            hasTime: true,
                            durationMinutes: detail.durationMinutes ?? 60,
                          });
                        }
                      }}
                      aria-label="Hora do compromisso"
                      className="h-8 rounded-md border border-transparent bg-transparent px-2 text-[13.5px] text-ink transition-colors hover:border-line focus:border-brand-600 focus:outline-none disabled:pointer-events-none"
                    />
                  )}

                  {detail.hasTime && (
                    <span className="w-32">
                      <SelectField
                        aria-label="Duração"
                        disabled={!canEdit}
                        value={String(detail.durationMinutes ?? 60)}
                        onChange={(next) =>
                          void patch("duration", { durationMinutes: Number(next) })
                        }
                        options={[15, 30, 45, 60, 90, 120].map((minutes) => ({
                          value: String(minutes),
                          label: formatDuration(minutes),
                        }))}
                      />
                    </span>
                  )}

                  {detail.dueDate && canEdit && (
                    <button
                      type="button"
                      onClick={() => void patch("dueDate", { dueDate: "" })}
                      className="rounded-sm p-1 text-ink-faint transition-colors hover:bg-surface-sunken hover:text-ink"
                      aria-label="Remover data"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>

                {detail.hasTime && detail.dueDate && (
                  <p className="px-2 text-[11.5px] text-ink-faint">
                    {formatTimeRange(detail.dueDate, detail.durationMinutes)}
                  </p>
                )}
              </FieldRow>

              <FieldRow icon={<Tag />} label="Etiquetas">
                <div className="flex flex-wrap items-center gap-1.5 py-1">
                  {detail.labels.map((label) => (
                    <span
                      key={label.id}
                      style={{
                        backgroundColor: withAlpha(label.color, 0.13),
                        color: label.color,
                      }}
                      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11.5px] font-medium"
                    >
                      {label.name}
                      {canEdit && (
                        <button
                          type="button"
                          aria-label={`Remover etiqueta ${label.name}`}
                          onClick={() =>
                            void patch("labels", {
                              labelIds: detail.labels
                                .filter((item) => item.id !== label.id)
                                .map((item) => item.id),
                            })
                          }
                          className="opacity-60 transition-opacity hover:opacity-100"
                        >
                          <X className="size-3" />
                        </button>
                      )}
                    </span>
                  ))}

                  {canEdit && (
                    <LabelPicker
                      labels={labels}
                      selected={selectedLabelIds}
                      onToggle={(labelId) => {
                        const next = selectedLabelIds.has(labelId)
                          ? detail.labels.filter((item) => item.id !== labelId).map((i) => i.id)
                          : [...detail.labels.map((i) => i.id), labelId];
                        void patch("labels", { labelIds: next });
                      }}
                      onCreate={handleCreateLabel}
                    />
                  )}
                </div>
              </FieldRow>
            </div>

            {/* Descrição */}
            <section className="mt-5">
              <h3 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                <AlignLeft className="size-3.5 text-ink-muted" />
                Descrição
              </h3>
              <textarea
                value={description}
                disabled={!canEdit}
                rows={4}
                maxLength={5000}
                placeholder="Adicione mais contexto sobre esta tarefa..."
                onChange={(event) => setDescription(event.target.value)}
                onBlur={() => {
                  if (description !== (detail.description ?? "")) {
                    void patch("description", { description });
                  }
                }}
                className="mt-2 w-full resize-y rounded-md border border-line bg-surface px-3 py-2.5 text-[13.5px] leading-relaxed text-ink placeholder:text-ink-faint focus:border-brand-600 focus:outline-none focus:ring-3 focus:ring-brand-600/12 disabled:bg-surface-muted"
              />
            </section>

            {/* Checklist */}
            <section className="mt-5">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                  <CheckSquare className="size-3.5 text-ink-muted" />
                  Checklist
                </h3>
                {detail.checklist.length > 0 && (
                  <span className="text-[12px] text-ink-muted">
                    {detail.checklistDone}/{detail.checklistTotal}
                  </span>
                )}
              </div>

              {detail.checklist.length > 0 && (
                <div
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-sunken"
                  role="progressbar"
                  aria-valuenow={detail.checklistDone}
                  aria-valuemin={0}
                  aria-valuemax={detail.checklistTotal}
                  aria-label="Progresso do checklist"
                >
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-[width] duration-300"
                    style={{
                      width: `${
                        detail.checklistTotal === 0
                          ? 0
                          : (detail.checklistDone / detail.checklistTotal) * 100
                      }%`,
                    }}
                  />
                </div>
              )}

              <ul className="mt-2 space-y-0.5">
                {detail.checklist.map((item) => (
                  <li key={item.id} className="group flex items-center gap-2.5 rounded-md px-1 py-1.5 hover:bg-surface-muted">
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => void toggleChecklistItem(item.id, !item.done)}
                      aria-label={item.done ? "Desmarcar item" : "Marcar item"}
                      aria-pressed={item.done}
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
                        item.done
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-line-strong hover:border-brand-600",
                      )}
                    >
                      {item.done && <Check className="size-2.5" strokeWidth={3.5} />}
                    </button>
                    <span
                      className={cn(
                        "min-w-0 flex-1 text-[13.5px] leading-snug",
                        item.done ? "text-ink-faint line-through" : "text-ink-soft",
                      )}
                    >
                      {item.content}
                    </span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setDeletingItem(item)}
                        aria-label={`Remover item ${item.content}`}
                        className="rounded-sm p-1 text-ink-faint opacity-0 transition-opacity hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>

              {canEdit && (
                <div className="mt-1.5 flex items-center gap-2">
                  <Plus className="size-3.5 shrink-0 text-ink-faint" />
                  <input
                    value={newChecklistItem}
                    maxLength={200}
                    placeholder="Adicionar item"
                    onChange={(event) => setNewChecklistItem(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleAddChecklistItem();
                      }
                    }}
                    aria-label="Novo item do checklist"
                    className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-[13.5px] text-ink placeholder:text-ink-faint hover:border-line focus:border-brand-600 focus:outline-none"
                  />
                </div>
              )}
            </section>

            {/* Comentários */}
            <section className="mt-6">
              <h3 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                <MessageSquare className="size-3.5 text-ink-muted" />
                Comentários
                {detail.comments.length > 0 && (
                  <span className="text-[12px] font-normal text-ink-muted">
                    {detail.comments.length}
                  </span>
                )}
              </h3>

              <ul className="mt-3 space-y-3">
                {detail.comments.map((comment) => (
                  <li key={comment.id} className="flex gap-2.5">
                    <Avatar
                      name={comment.author.name}
                      color={comment.author.avatarColor}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1 rounded-lg border border-line bg-surface-muted px-3 py-2">
                      <p className="flex items-baseline gap-2 text-[12.5px]">
                        <span className="font-medium text-ink">{comment.author.name}</span>
                        <span className="text-ink-faint">
                          {formatRelative(comment.createdAt)}
                        </span>
                      </p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-ink-soft">
                        {comment.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>

              {canEdit && (
                <div className="mt-3 flex gap-2.5">
                  <textarea
                    value={commentDraft}
                    rows={2}
                    maxLength={4000}
                    placeholder="Escreva um comentário..."
                    onChange={(event) => setCommentDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                        event.preventDefault();
                        void submitComment();
                      }
                    }}
                    aria-label="Novo comentário"
                    className="min-w-0 flex-1 resize-y rounded-md border border-line bg-surface px-3 py-2 text-[13.5px] leading-relaxed text-ink placeholder:text-ink-faint focus:border-brand-600 focus:outline-none focus:ring-3 focus:ring-brand-600/12"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    className="self-end"
                    disabled={commentDraft.trim().length === 0}
                    onClick={() => void submitComment()}
                  >
                    Enviar
                  </Button>
                </div>
              )}
            </section>

            {/* Rodapé de metadados */}
            <footer className="mt-6 border-t border-line pt-3 text-[11.5px] leading-relaxed text-ink-faint">
              Criada por {detail.createdBy.name} em {formatDate(detail.createdAt)} · Atualizada{" "}
              {formatRelative(detail.updatedAt)}
            </footer>
          </div>
        ) : null}
      </aside>

      <ConfirmDialog
        open={Boolean(deletingItem)}
        onClose={() => setDeletingItem(null)}
        onConfirm={async () => {
          if (deletingItem) await removeChecklistItem(deletingItem.id);
        }}
        title="Remover este item?"
        description={
          <>
            O item <strong className="font-medium text-ink">{deletingItem?.content}</strong> sai
            do checklist permanentemente.
          </>
        }
        confirmLabel="Remover item"
      />

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Excluir tarefa?"
        description={
          <>
            A tarefa <strong className="font-medium text-ink">{detail?.title}</strong> e todo o
            seu conteúdo serão removidos permanentemente. Essa ação não poderá ser desfeita.
          </>
        }
        confirmLabel="Excluir tarefa"
      />
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------

function LabelPicker({
  labels,
  selected,
  onToggle,
  onCreate,
}: {
  labels: { id: string; name: string; color: string }[];
  selected: Set<string>;
  onToggle: (labelId: string) => void;
  onCreate: (name: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <Dropdown
      width={236}
      align="start"
      trigger={({ ref, onClick, open, ...aria }) => (
        <button
          ref={ref}
          onClick={onClick}
          {...aria}
          data-open={open}
          className="inline-flex items-center gap-1 rounded border border-dashed border-line-strong px-1.5 py-0.5 text-[11.5px] font-medium text-ink-muted transition-colors hover:border-brand-400 hover:text-brand-600"
        >
          <Plus className="size-3" />
          Etiqueta
        </button>
      )}
    >
      {() => (
        <div>
          <DropdownLabel>Etiquetas do projeto</DropdownLabel>
          <div className="max-h-52 overflow-y-auto scrollbar-slim">
            {labels.length === 0 && (
              <p className="px-2.5 py-1.5 text-[12.5px] text-ink-faint">
                Nenhuma etiqueta ainda.
              </p>
            )}
            {labels.map((label) => (
              <label
                key={label.id}
                className="flex cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 text-[13px] transition-colors hover:bg-surface-sunken"
              >
                <input
                  type="checkbox"
                  checked={selected.has(label.id)}
                  onChange={() => onToggle(label.id)}
                  className="size-3.5 shrink-0 accent-[#2563EB]"
                />
                <span
                  aria-hidden="true"
                  style={{ backgroundColor: label.color }}
                  className="size-2 shrink-0 rounded-full"
                />
                <span className="truncate">{label.name}</span>
              </label>
            ))}
          </div>

          <div className="mt-1 border-t border-line pt-1">
            <input
              ref={inputRef}
              value={draft}
              maxLength={28}
              placeholder="Nova etiqueta..."
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && draft.trim()) {
                  event.preventDefault();
                  void onCreate(draft.trim());
                  setDraft("");
                }
              }}
              className="w-full rounded-sm px-2 py-1.5 text-[13px] text-ink placeholder:text-ink-faint focus:outline-none"
            />
          </div>
        </div>
      )}
    </Dropdown>
  );
}
