"use client";

import { useState } from "react";
import { Bell, BellOff } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { api } from "@/lib/api-client";
import { Tooltip } from "@/components/ui/Tooltip";
import { useToast } from "@/components/ui/Toast";

export interface ProjectMuteToggleProps {
  projectId: string;
  initialMuted: boolean;
}

/**
 * Silencia as notificações deste projeto — só para quem clicou.
 * Os demais membros continuam recebendo normalmente.
 */
export function ProjectMuteToggle({ projectId, initialMuted }: ProjectMuteToggleProps) {
  const toast = useToast();
  const [muted, setMuted] = useState(initialMuted);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !muted;
    setBusy(true);
    setMuted(next); // otimista: o botão responde na hora

    try {
      await api.patch("/api/notifications", {
        action: "mute-project",
        projectId,
        muted: next,
      });
      toast.success(
        next ? "Notificações silenciadas neste projeto." : "Notificações reativadas.",
        next ? "Só para você. O time continua recebendo." : undefined,
      );
    } catch (error) {
      setMuted(!next);
      toast.error(
        "Não foi possível alterar.",
        error instanceof Error ? error.message : undefined,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Tooltip
      content={
        muted
          ? "Notificações silenciadas — clique para reativar"
          : "Silenciar notificações deste projeto"
      }
    >
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={busy}
        aria-pressed={muted}
        aria-label={
          muted
            ? "Reativar notificações deste projeto"
            : "Silenciar notificações deste projeto"
        }
        className={cn(
          "rounded-md p-2 transition-colors disabled:opacity-60",
          muted
            ? "text-amber-600 hover:bg-amber-50"
            : "text-ink-faint hover:bg-surface-sunken hover:text-ink-soft",
        )}
      >
        {muted ? <BellOff className="size-4" /> : <Bell className="size-4" />}
      </button>
    </Tooltip>
  );
}
