"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { useMounted } from "@/hooks/useMounted";

type ToastTone = "success" | "error" | "info";

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
  description?: string;
}

interface ToastApi {
  success: (message: string, description?: string) => void;
  error: (message: string, description?: string) => void;
  info: (message: string, description?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const TONE_META: Record<ToastTone, { icon: typeof Info; accent: string; iconClass: string }> = {
  success: { icon: CheckCircle2, accent: "bg-emerald-500", iconClass: "text-emerald-600" },
  error: { icon: AlertCircle, accent: "bg-red-500", iconClass: "text-red-600" },
  info: { icon: Info, accent: "bg-brand-600", iconClass: "text-brand-600" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const mounted = useMounted();

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, message: string, description?: string) => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-3), { id, tone, message, description }]);
      window.setTimeout(() => dismiss(id), tone === "error" ? 6000 : 3800);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message, description) => push("success", message, description),
      error: (message, description) => push("error", message, description),
      info: (message, description) => push("info", message, description),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {mounted &&
        createPortal(
          <div
            role="region"
            aria-label="Notificações"
            className="pointer-events-none fixed bottom-4 right-4 z-200 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2 sm:bottom-6 sm:right-6"
          >
            {toasts.map((toast) => {
              const meta = TONE_META[toast.tone];
              const Icon = meta.icon;
              return (
                <div
                  key={toast.id}
                  role="status"
                  aria-live="polite"
                  className="pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-lg border border-line bg-surface py-3 pl-4 pr-3 shadow-lg animate-slide-left"
                >
                  <span className={cn("absolute inset-y-0 left-0 w-[3px]", meta.accent)} />
                  <Icon className={cn("mt-px size-4.5 shrink-0", meta.iconClass)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium leading-snug text-ink">
                      {toast.message}
                    </p>
                    {toast.description && (
                      <p className="mt-0.5 text-[12.5px] leading-snug text-ink-muted">
                        {toast.description}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => dismiss(toast.id)}
                    aria-label="Dispensar notificação"
                    className="-mr-0.5 -mt-0.5 rounded-sm p-1 text-ink-faint transition-colors hover:bg-surface-sunken hover:text-ink-soft"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast precisa estar dentro de <ToastProvider>.");
  return context;
}
