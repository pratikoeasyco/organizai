"use client";

/**
 * Ponte entre o navegador e o nosso servidor de push.
 *
 * Tudo aqui degrada em silêncio quando não é suportado: navegador antigo,
 * página servida sem HTTPS, permissão negada. O app continua funcionando —
 * só não notifica.
 */

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export type PushStatus =
  | "unsupported" // navegador ou contexto sem suporte
  | "insecure" // precisa de HTTPS (ou localhost)
  | "unconfigured" // servidor sem chaves VAPID
  | "denied" // pessoa bloqueou
  | "default" // ainda não decidiu
  | "granted"; // permitido e inscrito

/**
 * A chave VAPID viaja em base64url, mas `pushManager.subscribe` espera bytes.
 * Devolve um ArrayBuffer para casar com o tipo `BufferSource` esperado.
 */
function urlBase64ToBytes(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) view[i] = raw.charCodeAt(i);
  return buffer;
}

export function getPushStatus(): PushStatus {
  if (typeof window === "undefined") return "unsupported";
  if (!PUBLIC_KEY) return "unconfigured";

  // Push exige contexto seguro. localhost conta como seguro; um IP de rede
  // local (192.168.x.x) por HTTP, não — é a pegadinha mais comum ao testar
  // no celular.
  if (!window.isSecureContext) return "insecure";

  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
  if (!("Notification" in window)) return "unsupported";

  if (Notification.permission === "denied") return "denied";
  if (Notification.permission === "granted") return "granted";
  return "default";
}

let updateTimer: number | null = null;

/**
 * Registra o service worker e mantém o app atualizado sozinho.
 *
 * Três peças fazem a atualização acontecer sem reinstalar:
 *  - `updateViaCache: "none"` impede que o próprio sw.js venha do cache HTTP,
 *    que é o motivo clássico de um PWA ficar preso numa versão antiga;
 *  - `update()` periódico e ao voltar para o app procuram versão nova;
 *  - o `skipWaiting`/`clients.claim()` dentro do sw.js assume o controle na
 *    hora, sem esperar todas as abas fecharem.
 *
 * Como não há cache de conteúdo, as telas já vêm sempre da rede: o que se
 * atualiza aqui é o próprio worker.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });

    // Uma versão nova assumiu o controle: recarrega para a pessoa passar a
    // usar o app atualizado sem fazer nada.
    let recarregando = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (recarregando) return;
      recarregando = true;
      window.location.reload();
    });

    const procurarAtualizacao = () => {
      registration.update().catch(() => undefined);
    };

    // Ao reabrir o app instalado, a primeira coisa é conferir se há versão nova.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") procurarAtualizacao();
    });
    window.addEventListener("online", procurarAtualizacao);

    if (updateTimer === null) {
      updateTimer = window.setInterval(procurarAtualizacao, 60 * 60 * 1000);
    }

    return registration;
  } catch (error) {
    console.error("[organizai] service worker não registrou:", error);
    return null;
  }
}

/**
 * Pede permissão e inscreve este navegador. Devolve true quando ficou tudo
 * pronto para receber.
 */
export async function enablePush(): Promise<boolean> {
  const status = getPushStatus();
  if (status === "unsupported" || status === "insecure" || status === "unconfigured") {
    return false;
  }

  const permission =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();
  if (permission !== "granted") return false;

  const registration = (await registerServiceWorker()) ?? (await navigator.serviceWorker.ready);
  if (!registration) return false;

  try {
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        // Sem isto o navegador recusa: exige que todo push mostre notificação.
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBytes(PUBLIC_KEY),
      }));

    const json = subscription.toJSON();
    const response = await fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
      }),
    });

    return response.ok;
  } catch (error) {
    console.error("[organizai] inscrição de push falhou:", error);
    return false;
  }
}

/** Cancela a inscrição deste navegador. A permissão em si continua concedida. */
export async function disablePush(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    await fetch("/api/push", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
    await subscription.unsubscribe();
  } catch (error) {
    console.error("[organizai] falha ao cancelar inscrição:", error);
  }
}

export async function isSubscribed(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return false;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return false;
    return Boolean(await registration.pushManager.getSubscription());
  } catch {
    return false;
  }
}
