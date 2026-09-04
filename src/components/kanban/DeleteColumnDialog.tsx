"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SelectField } from "@/components/ui/SelectField";
import type { BoardColumnData } from "@/types/domain";

type Strategy = "move" | "archive" | "delete";

export interface DeleteColumnDialogProps {
  column: BoardColumnData | null;
  columns: BoardColumnData[];
  onClose: () => void;
  onConfirm: (options: { strategy: Strategy; targetColumnId?: string | null }) => Promise<void>;
}

/**
 * Excluir uma coluna com tarefas exige uma decisão explícita sobre elas —
 * nada é apagado silenciosamente.
 */
export function DeleteColumnDialog({
  column,
  columns,
  onClose,
  onConfirm,
}: DeleteColumnDialogProps) {
  const others = columns.filter((item) => item.id !== column?.id);
  const taskCount = column?.tasks.length ?? 0;

  const [strategy, setStrategy] = useState<Strategy>("move");
  const [targetId, setTargetId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!column) return;
    setStrategy(others.length > 0 ? "move" : "archive");
    setTargetId(others[0]?.id ?? "");
    setBusy(false);
    // `others` deriva de `column`; recalcular a cada render travaria o efeito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [column]);

  if (!column) return null;

  const options: { id: Strategy; label: string; description: string; disabled?: boolean }[] = [
    {
      id: "move",
      label: "Mover as tarefas para outra coluna",
      description: "Nenhuma tarefa é perdida.",
      disabled: others.length === 0,
    },
    {
      id: "archive",
      label: "Arquivar as tarefas",
      description: "Saem do quadro, mas continuam no histórico.",
    },
    {
      id: "delete",
      label: "Excluir a coluna e as tarefas",
      description: "Remoção permanente. Não pode ser desfeita.",
    },
  ];

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm({
        strategy,
        targetColumnId: strategy === "move" ? targetId : null,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      busy={busy}
      title={`Excluir a coluna "${column.name}"?`}
      description={
        taskCount === 0
          ? "Esta coluna está vazia e será removida do quadro."
          : `Esta coluna tem ${taskCount === 1 ? "1 tarefa" : `${taskCount} tarefas`}. Escolha o que fazer com ${taskCount === 1 ? "ela" : "elas"}.`
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirm}
            loading={busy}
            disabled={strategy === "move" && !targetId}
          >
            Excluir coluna
          </Button>
        </>
      }
    >
      {taskCount === 0 ? (
        <div className="flex gap-3 rounded-lg border border-line bg-surface-muted p-3.5">
          <AlertTriangle className="mt-px size-4.5 shrink-0 text-amber-600" />
          <p className="text-[13.5px] leading-relaxed text-ink-soft">
            A coluna será removida permanentemente do quadro.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {options.map((option) => (
            <label
              key={option.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                option.disabled && "cursor-not-allowed opacity-50",
                strategy === option.id
                  ? "border-brand-600 bg-brand-50"
                  : "border-line hover:border-line-strong hover:bg-surface-muted",
              )}
            >
              <input
                type="radio"
                name="delete-strategy"
                value={option.id}
                checked={strategy === option.id}
                disabled={option.disabled}
                onChange={() => setStrategy(option.id)}
                className="mt-0.5 size-4 shrink-0 accent-[#2563EB]"
              />
              <span className="min-w-0">
                <span className="block text-[13.5px] font-medium text-ink">{option.label}</span>
                <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-muted">
                  {option.description}
                </span>

                {option.id === "move" && strategy === "move" && others.length > 0 && (
                  <span className="mt-2.5 block" onClick={(event) => event.preventDefault()}>
                    <SelectField
                      aria-label="Coluna de destino"
                      value={targetId}
                      onChange={setTargetId}
                      options={others.map((item) => ({
                        value: item.id,
                        label: item.name,
                        color: item.color,
                        description:
                          item.tasks.length === 1
                            ? "1 tarefa hoje"
                            : `${item.tasks.length} tarefas hoje`,
                      }))}
                    />
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
      )}
    </Modal>
  );
}
