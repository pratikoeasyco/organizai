"use client";

import { useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  /** Bloqueia a confirmação até o usuário cumprir um requisito extra. */
  confirmDisabled?: boolean;
}

/** Confirmação para ações destrutivas — nunca apaga nada sem passar por aqui. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "danger",
  confirmDisabled = false,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      busy={busy}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            onClick={handleConfirm}
            loading={busy}
            disabled={confirmDisabled}
            data-autofocus
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3.5">
        {tone === "danger" && (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-red-50">
            <AlertTriangle className="size-4.5 text-red-600" />
          </span>
        )}
        <div className="min-w-0 pt-0.5">
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          <div className="mt-1.5 text-[13.5px] leading-relaxed text-ink-muted">{description}</div>
        </div>
      </div>
    </Modal>
  );
}
