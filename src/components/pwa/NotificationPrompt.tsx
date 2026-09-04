"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, CalendarClock, Check, MoveRight, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
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

const MOTIVOS = [
  { icone: MoveRight, texto: "Quando alguém move uma tarefa no quadro" },
  { icone: Sparkles, texto: "Quando uma tarefa nova é criada no projeto" },
  { icone: CalendarClock, texto: "Antes de um compromisso começar" },
];

/**
 * Pede permissão de notificação quando o app instalado abre pela primeira vez.
 *
 * É um diálogo no centro da tela, e não um aviso de canto, porque a permissão
 * só pode ser pedida **uma vez**: a recusa na caixa nativa é definitiva e não
 * há como perguntar de novo pelo app. Um convite que passa despercebido custa a
 * funcionalidade inteira para aquela pessoa.
 *
 * Por que um diálogo nosso antes da caixa do sistema: no iOS a caixa nativa SÓ
 * abre a partir de um toque — não existe forma de dispará-la ao abrir o app.
 * Então o toque precisa existir, e é este botão. De quebra, quem chega na caixa
 * do sistema já sabe o que está aceitando.
 *
 * Só aparece no app instalado: no navegador do iPhone o push nem existe, e quem
 * ainda não instalou está vendo o convite de instalação.
 */
export function NotificationPrompt() {
  const toast = useToast();
  const [aberto, setAberto] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!estaInstalado()) return;
    if (localStorage.getItem(DISPENSADO) === "1") return;
    // "default" = ainda não perguntamos. Se já concedeu ou negou, não há o que
    // fazer aqui — e se o servidor não tem chaves, o push nem existe.
    if (getPushStatus() !== "default") return;

    // Um respiro antes de abrir: interromper a pessoa no primeiro quadro da
    // tela, antes de ela ver o que é o app, é o que faz recusar por reflexo.
    const timer = window.setTimeout(() => setAberto(true), 1500);
    return () => window.clearTimeout(timer);
  }, []);

  /**
   * Fechar pelo X ou pelo fundo só adia — volta na próxima abertura. Some de
   * vez apenas quando a pessoa diz "agora não" de propósito, ou depois de
   * decidir na caixa do sistema. Um toque fora da caixa não pode custar a
   * funcionalidade para sempre.
   */
  const adiar = useCallback(() => setAberto(false), []);

  const recusar = useCallback(() => {
    setAberto(false);
    localStorage.setItem(DISPENSADO, "1");
  }, []);

  const ativar = useCallback(async () => {
    setOcupado(true);
    const ok = await enablePush();
    setOcupado(false);
    setAberto(false);
    localStorage.setItem(DISPENSADO, "1");

    if (ok) {
      toast.success("Notificações ativadas neste aparelho.");
    } else if (getPushStatus() === "denied") {
      toast.error(
        "Notificações bloqueadas.",
        "Para reativar é preciso liberar nos ajustes do aparelho — o navegador não pergunta de novo.",
      );
    } else {
      toast.error("Não foi possível ativar as notificações agora.");
    }
  }, [toast]);

  return (
    <Modal
      open={aberto}
      onClose={adiar}
      size="sm"
      busy={ocupado}
      ariaLabel="Ativar notificações"
    >
      <div className="flex flex-col items-center text-center">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <Bell className="size-8" />
        </span>

        <h2 className="mt-4 text-[17px] font-semibold text-ink">Ativar notificações</h2>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-muted">
          Fique sabendo do que acontece nos seus projetos sem precisar abrir o
          app o tempo todo.
        </p>

        <ul className="mt-5 w-full space-y-2.5 text-left">
          {MOTIVOS.map(({ icone: Icone, texto }) => (
            <li key={texto} className="flex items-center gap-2.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-ink-soft">
                <Icone className="size-3.5" />
              </span>
              <span className="text-[13px] leading-snug text-ink-soft">{texto}</span>
            </li>
          ))}
        </ul>

        <p className="mt-4 flex items-start gap-1.5 text-[12px] leading-relaxed text-ink-faint">
          <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
          Dá para silenciar projeto por projeto depois, quando quiser.
        </p>

        <Button
          onClick={ativar}
          loading={ocupado}
          data-autofocus
          className="mt-5 w-full"
          size="lg"
        >
          Permitir notificações
        </Button>

        <button
          type="button"
          onClick={recusar}
          disabled={ocupado}
          className="mt-2 rounded-md px-3 py-2 text-[13px] font-medium text-ink-faint transition-colors hover:text-ink-soft"
        >
          Agora não
        </button>
      </div>
    </Modal>
  );
}
