"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";

import { Button } from "@/components/ui/Button";

/** Evento do Chrome que permite disparar a instalação por conta própria. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISPENSADO = "organizai:install-dispensado";

function estaInstalado() {
  if (typeof window === "undefined") return true;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari do iPhone não implementa display-mode; usa esta propriedade.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function detectarIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // O iPad moderno se apresenta como Mac; o que o denuncia é ter toque.
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

/** No iPhone só o Safari consegue instalar — Chrome e Firefox lá não instalam. */
function ehSafari() {
  if (typeof navigator === "undefined") return false;
  return !/crios|fxios|edgios|opios/i.test(navigator.userAgent);
}

/**
 * Convida a instalar o app, porque instalado é a única forma de ele abrir em
 * tela cheia — e, no iPhone, de as notificações funcionarem.
 *
 * São dois caminhos bem diferentes:
 *  - Android/desktop: o navegador entrega um evento e nós disparamos a
 *    instalação com um toque.
 *  - iPhone: a Apple não oferece esse evento. A instalação é manual, por um
 *    menu que ninguém encontra sozinho — então explicamos onde fica.
 */
export function InstallPrompt() {
  const [evento, setEvento] = useState<BeforeInstallPromptEvent | null>(null);
  const [visivel, setVisivel] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (estaInstalado()) return;
    if (localStorage.getItem(DISPENSADO) === "1") return;

    const noIOS = detectarIOS();
    setIos(noIOS);

    if (noIOS) {
      // Sem evento para esperar: ou dá para instalar pelo Safari, ou nem isso.
      if (ehSafari()) setVisivel(true);
      return;
    }

    function aoPoderInstalar(event: Event) {
      // Impede a barra padrão do Chrome para mostrarmos a nossa, no momento
      // certo e com o texto do produto.
      event.preventDefault();
      setEvento(event as BeforeInstallPromptEvent);
      setVisivel(true);
    }

    window.addEventListener("beforeinstallprompt", aoPoderInstalar);
    return () => window.removeEventListener("beforeinstallprompt", aoPoderInstalar);
  }, []);

  // Some sozinho assim que a instalação acontece.
  useEffect(() => {
    function instalado() {
      setVisivel(false);
      localStorage.setItem(DISPENSADO, "1");
    }
    window.addEventListener("appinstalled", instalado);
    return () => window.removeEventListener("appinstalled", instalado);
  }, []);

  const dispensar = useCallback(() => {
    setVisivel(false);
    localStorage.setItem(DISPENSADO, "1");
  }, []);

  const instalar = useCallback(async () => {
    if (!evento) return;
    await evento.prompt();
    const { outcome } = await evento.userChoice;
    if (outcome === "accepted") localStorage.setItem(DISPENSADO, "1");
    setVisivel(false);
    setEvento(null);
  }, [evento]);

  if (!visivel) return null;

  return (
    <div
      role="complementary"
      aria-label="Instalar o aplicativo"
      className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-60 px-3 pb-2 lg:bottom-4 lg:left-auto lg:right-4 lg:w-[340px] lg:px-0"
    >
      <div className="flex items-start gap-3 rounded-xl border border-line bg-surface p-3 shadow-pop">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          <Download className="size-4.5" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold leading-tight text-ink">
            Instale o Organizaí
          </p>

          {ios ? (
            <>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
                Abre em tela cheia, sem a barra do Safari — e é o único jeito de
                receber notificações no iPhone.
              </p>
              <p className="mt-2 flex flex-wrap items-center gap-1 text-[12.5px] leading-relaxed text-ink-soft">
                Toque em
                <Share className="inline size-3.5 shrink-0 text-brand-600" aria-hidden="true" />
                <span className="font-medium">Compartilhar</span>
                <span aria-hidden="true">→</span>
                <SquarePlus className="inline size-3.5 shrink-0 text-brand-600" aria-hidden="true" />
                <span className="font-medium">Adicionar à Tela de Início</span>
              </p>
            </>
          ) : (
            <>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
                Abre em tela cheia, sem barra de endereço, e fica junto dos seus
                outros aplicativos.
              </p>
              <Button size="sm" onClick={instalar} className="mt-2.5">
                Instalar app
              </Button>
            </>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={dispensar}
          aria-label="Dispensar"
          className="-mr-1 -mt-1 shrink-0"
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
