"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, BellRing, CalendarClock, MoveRight, Plus } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { formatRelative } from "@/lib/utils/format";
import {
  disablePush,
  enablePush,
  getPushStatus,
  isSubscribed,
  registerServiceWorker,
  type PushStatus,
} from "@/lib/push-client";
import type { NotificationEntry } from "@/server/services/notifications";

const ICONS: Record<string, typeof Bell> = {
  "task.created": Plus,
  "task.moved": MoveRight,
  "event.created": CalendarClock,
  "event.reminder": BellRing,
  "event.start": BellRing,
};

const AVISOS: Partial<Record<PushStatus, string>> = {
  insecure:
    "Notificações exigem HTTPS. Em localhost funciona; num IP da rede local, não.",
  unsupported: "Este navegador não suporta notificações push.",
  unconfigured: "O servidor está sem as chaves de push configuradas.",
  denied:
    "Você bloqueou as notificações para este site. Libere nas permissões do navegador.",
};

export function NotificationBell() {
  const router = useRouter();
  const toast = useToast();

  const [items, setItems] = useState<NotificationEntry[]>([]);
  const [unread, setUnread] = useState(0);
  const [status, setStatus] = useState<PushStatus>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ items: NotificationEntry[]; unread: number }>(
        "/api/notifications",
      );
      setItems(data.items);
      setUnread(data.unread);
    } catch {
      // Sino é secundário: falhar aqui não pode atrapalhar a navegação.
    }
  }, []);

  useEffect(() => {
    setStatus(getPushStatus());
    void registerServiceWorker();
    void isSubscribed().then(setSubscribed);
    void load();

    // Busca periódica: o push avisa fora do app, isto mantém o sino em dia
    // enquanto a aba está aberta.
    const timer = window.setInterval(load, 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function togglePush() {
    setBusy(true);
    if (subscribed) {
      await disablePush();
      setSubscribed(false);
      toast.info("Notificações desativadas neste navegador.");
    } else {
      const ok = await enablePush();
      setStatus(getPushStatus());
      setSubscribed(ok);
      if (ok) toast.success("Notificações ativadas neste dispositivo.");
      else toast.error("Não foi possível ativar.", AVISOS[getPushStatus()]);
    }
    setBusy(false);
  }

  async function markRead() {
    if (unread === 0) return;
    setUnread(0);
    setItems((current) => current.map((item) => ({ ...item, readAt: new Date().toISOString() })));
    await api.patch("/api/notifications", { action: "read-all" }).catch(() => undefined);
  }

  const aviso = AVISOS[status];

  return (
    <Dropdown
      width={352}
      trigger={({ ref, onClick, open, ...aria }) => (
        <button
          ref={ref}
          onClick={() => {
            onClick();
            if (!open) void load();
          }}
          {...aria}
          type="button"
          aria-label={unread > 0 ? `Notificações (${unread} não lidas)` : "Notificações"}
          className={cn(
            "relative rounded-md p-2 text-ink-soft transition-colors hover:bg-surface-sunken",
            open && "bg-surface-sunken",
          )}
        >
          <Bell className="size-4.5" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-4 text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      )}
    >
      {({ close }) => (
        <div>
          <div className="flex items-center justify-between px-2.5 pb-1.5 pt-2">
            <p className="text-[13px] font-semibold text-ink">Notificações</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => void markRead()}
                className="rounded-sm text-[12px] font-medium text-brand-600 transition-colors hover:text-brand-700"
              >
                Marcar como lidas
              </button>
            )}
          </div>

          {/* Ativar push é a primeira coisa que o app oferece. */}
          <div className="mx-1 mb-1 rounded-md border border-line bg-surface-muted p-2.5">
            {aviso ? (
              <p className="text-[11.5px] leading-relaxed text-ink-muted">{aviso}</p>
            ) : (
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-md",
                    subscribed ? "bg-brand-50 text-brand-600" : "bg-surface-sunken text-ink-faint",
                  )}
                >
                  {subscribed ? <BellRing className="size-3.5" /> : <BellOff className="size-3.5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-medium text-ink">
                    {subscribed ? "Ativadas neste dispositivo" : "Ativar notificações"}
                  </span>
                  <span className="block text-[11px] leading-tight text-ink-muted">
                    {subscribed
                      ? "Você recebe avisos mesmo com o app fechado."
                      : "Receba avisos do time e lembretes de reunião."}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant={subscribed ? "secondary" : "primary"}
                  loading={busy}
                  onClick={() => void togglePush()}
                >
                  {subscribed ? "Desligar" : "Ativar"}
                </Button>
              </div>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto scrollbar-slim">
            {items.length === 0 ? (
              <EmptyState
                compact
                icon={<Bell />}
                title="Nada por aqui"
                description="Avisos do time e lembretes de compromisso aparecem aqui."
              />
            ) : (
              items.map((item) => {
                const Icon = ICONS[item.type] ?? Bell;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      close();
                      void markRead();
                      if (item.url) router.push(item.url);
                    }}
                    className={cn(
                      "flex w-full items-start gap-2.5 rounded-sm px-2.5 py-2 text-left transition-colors hover:bg-surface-sunken",
                      !item.readAt && "bg-brand-50/60",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md",
                        item.readAt
                          ? "bg-surface-sunken text-ink-faint"
                          : "bg-brand-100 text-brand-700",
                      )}
                    >
                      <Icon className="size-3" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium text-ink">
                        {item.title}
                      </span>
                      <span className="block truncate text-[11.5px] text-ink-muted">
                        {item.body}
                      </span>
                      <span className="mt-0.5 block text-[10.5px] text-ink-faint">
                        {formatRelative(item.createdAt)}
                      </span>
                    </span>
                    {!item.readAt && (
                      <span
                        aria-label="Não lida"
                        className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-600"
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </Dropdown>
  );
}

