"use client";

import { useEffect, useRef } from "react";

export interface ChangeEvent {
  type:
    | "project.created"
    | "project.updated"
    | "project.deleted"
    | "column.changed"
    | "task.changed"
    | "event.changed"
    | "member.changed";
  companyId: string;
  projectId?: string;
  actorId: string;
  at: number;
}

/**
 * Ouve as mudanças feitas por outras pessoas e chama `onChange`.
 *
 * Uma conexão SSE por aba. O navegador já reconecta sozinho quando a conexão
 * cai — o `retry` vem do servidor —, então não há laço de reconexão aqui.
 *
 * O callback fica numa ref para que trocá-lo não derrube e recrie a conexão a
 * cada render.
 */
export function useLiveChanges(onChange: (event: ChangeEvent) => void): void {
  const handler = useRef(onChange);
  handler.current = onChange;

  useEffect(() => {
    if (typeof window === "undefined" || !("EventSource" in window)) return;

    const source = new EventSource("/api/stream");

    const listener = (message: MessageEvent<string>) => {
      try {
        handler.current(JSON.parse(message.data) as ChangeEvent);
      } catch {
        // Mensagem malformada não pode derrubar a aba.
      }
    };

    source.addEventListener("change", listener as EventListener);

    return () => {
      source.removeEventListener("change", listener as EventListener);
      source.close();
    };
  }, []);
}
