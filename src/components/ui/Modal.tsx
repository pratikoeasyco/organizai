"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { isTopOverlay, popOverlay, pushOverlay } from "@/components/ui/modal-stack";
import { useMounted } from "@/hooks/useMounted";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";

type ModalSize = "sm" | "md" | "lg";

const SIZES: Record<ModalSize, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
};

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /**
   * Nome acessível quando o modal não tem `title` — caso de diálogos que
   * desenham o próprio cabeçalho. Sem isto o leitor de tela anuncia apenas
   * "diálogo", sem dizer do quê.
   */
  ariaLabel?: string;
  description?: string;
  size?: ModalSize;
  children: ReactNode;
  footer?: ReactNode;
  /** Impede fechar por clique fora / Esc durante uma operação em andamento. */
  busy?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  ariaLabel,
  description,
  size = "md",
  children,
  footer,
  busy = false,
}: ModalProps) {
  const mounted = useMounted();
  const panelRef = useRef<HTMLDivElement>(null);
  const overlayId = useId();

  useLockBodyScroll(open);

  // Registra na pilha para que só o modal do topo responda ao Esc.
  useEffect(() => {
    if (!open) return;
    pushOverlay(overlayId);
    return () => popOverlay(overlayId);
  }, [open, overlayId]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy && isTopOverlay(overlayId)) {
        event.stopPropagation();
        onClose();
        return;
      }

      // Mantém o foco preso dentro do modal (acessibilidade por teclado).
      if (event.key === "Tab" && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, busy, overlayId]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      const target = panelRef.current?.querySelector<HTMLElement>(
        "[data-autofocus], input:not([type=hidden]), textarea, button",
      );
      target?.focus();
    }, 40);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    // Centralizado em todo tamanho de tela, com margem em volta. Antes era uma
    // "folha" colada na base no celular, encostando nas bordas — e no iPhone o
    // rodapé de botões ficava por baixo do indicador de início.
    // `max(...)` garante a margem mínima mesmo em aparelho sem entalhe.
    <div
      className={cn(
        "fixed inset-0 z-100 flex items-center justify-center",
        "px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]",
        "sm:px-6",
      )}
    >
      <div
        className="absolute inset-0 bg-slate-900/25 backdrop-blur-[2px] animate-fade-in"
        onClick={() => !busy && onClose()}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? ariaLabel}
        className={cn(
          "relative w-full bg-surface shadow-pop animate-scale-in",
          // `dvh` e não `vh`: no Safari do iPhone a barra do navegador aparece e
          // some, e `100vh` ignora isso — o modal ficava mais alto que a tela e
          // os botões do rodapé saíam para fora.
          "max-h-[calc(100dvh-2rem)] overflow-y-auto scrollbar-slim",
          "rounded-2xl",
          SIZES[size],
        )}
      >
        {title && (
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
              {description && (
                <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{description}</p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              disabled={busy}
              aria-label="Fechar"
              className="-mr-1 shrink-0"
            >
              <X className="size-4" />
            </Button>
          </div>
        )}

        <div className="px-5 py-5 sm:px-6">{children}</div>

        {footer && (
          // No celular os botões ocupam a largura toda e empilham, com a ação
          // principal em cima — alvo de toque maior e ordem que o polegar
          // encontra primeiro. `col-reverse` inverte a ordem visual, então o
          // último botão do código (o principal) sobe.
          <div className="flex flex-col-reverse gap-2 border-t border-line bg-surface-muted px-5 py-3.5 sm:flex-row sm:items-center sm:justify-end sm:px-6 [&>*]:w-full sm:[&>*]:w-auto">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
