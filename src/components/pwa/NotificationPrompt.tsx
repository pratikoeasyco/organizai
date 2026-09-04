"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { enablePush, getPushStatus } from "@/lib/push-client";

const DISPENSADO = "organizai:notif-dispensado";

function estaInstalado() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Pede permissão de notificação logo que o app instalado abre pela primeira vez.
 *
 * Por que um cartão nosso e não a caixa do sistema direto: no iOS a caixa nativa
 * SÓ abre a partir de um toque da pessoa — não existe forma de dispará-la ao
 * abrir o app. Então o toque tem que existir, e é este botão.
 *
 * Isso também protege de um erro caro: a recusa na caixa nativa é definitiva.
 * Quem toca em "não permitir" sem entender o que era não consegue mais ativar
 * pelo app — só nos ajustes do aparelho. Explicar antes de perguntar evita que
 * a pessoa se bloqueie sem querer.
 *
 * Só aparece no app instalado: no navegador do iPhone o push nem existe, e
 * quem ainda não instalou está vendo o convite de instalação.
 */
export function NotificationPrompt() {
  const toast = useToast();
  const [visivel, setVisivel] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!estaInstalado()) return;
    if (localStorage.getItem(DISPENSADO) === "1") return;
    // "default" = ainda não perguntamos. Se já concedeu ou negou, não há o que
    // fazer aqui.
    if (getPushStatus() !== "default") return;

    // Um respiro antes de aparecer: pedir permissão no primeiro instante, antes
    // de a pessoa ver qualquer coisa, é o que faz todo mundo recusar.
    const timer = window.setTimeout(() => setVisivel(true), 1200);
    return () => window.clearTimeout(timer);
  }, []);

  const dispensar = useCallback(() => {
    setVisivel(false);
    localStorage.setItem(DISPENSADO, "1");
  }, []);

  const ativar = useCallback(async () => {
    setOcupado(true);
    const ok = await enablePush();
    setOcupado(false);
    setVisivel(false);
    localStorage.setItem(DISPENSADO, "1");

    if (ok) {
      toast.success("Notificações ativadas neste aparelho.");
    } else if (getPushStatus() === "denied") {
      toast.error(
        "Notificações bloqueadas.",
        "Para reativar, é preciso liberar nos ajustes do aparelho — o navegador não pergunta de novo.",
      );
    } else {
      toast.error("Não foi possível ativar as notificações agora.");
    }
  }, [toast]);

  if (!visivel) return null;

  return (
    <div
      role="complementary"
      aria-label="Ativar notificações"
      className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-60 px-3 pb-2 lg:bottom-4 lg:left-auto lg:right-4 lg:w-[340px] lg:px-0"
    >
      <div className="flex items-start gap-3 rounded-xl border border-line bg-surface p-3 shadow-pop">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          <Bell className="size-4.5" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold leading-tight text-ink">
            Ativar notificações
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
            Avisamos quando alguém move uma tarefa sua, cria algo no projeto e
            antes dos compromissos começarem. Você pode silenciar projeto por
            projeto depois.
          </p>
          <Button size="sm" onClick={ativar} loading={ocupado} className="mt-2.5">
            Permitir notificações
          </Button>
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={dispensar}
          disabled={ocupado}
          aria-label="Agora não"
          className="-mr-1 -mt-1 shrink-0"
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
