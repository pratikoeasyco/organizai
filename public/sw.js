/**
 * Service worker do Organizaí.
 *
 * Faz três coisas, de propósito nada além disso:
 *  1. recebe push e mostra a notificação
 *  2. leva ao lugar certo quando a pessoa clica
 *  3. atende as navegações, o que é condição para o app ser instalável
 *
 * Continua SEM cache de conteúdo. Um cache mal feito serve tela velha e é pior
 * que não ter cache nenhum — isso entra depois, com cuidado.
 */

self.addEventListener("install", () => {
  // Assume o controle sem esperar as abas antigas fecharem.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/**
 * Atende as navegações — e existir já é metade do motivo.
 *
 * O Chrome no Android só transforma o site num app de verdade (WebAPK, que abre
 * em tela cheia e aparece na gaveta de aplicativos) se o service worker tiver um
 * handler de `fetch`. Sem ele, "adicionar à tela de início" cria apenas um
 * ATALHO, que abre dentro do navegador, com barra de endereço — exatamente o
 * sintoma de "não parece app".
 *
 * Aqui não se guarda nada: a requisição vai para a rede como sempre. A única
 * diferença é quando a rede falha, e aí mostramos uma tela nossa em vez do erro
 * do navegador, que num app instalado é constrangedor.
 */
const PAGINA_OFFLINE = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Sem conexão · Organizaí</title>
<style>
  :root { color-scheme: light }
  body { margin:0; min-height:100dvh; display:grid; place-items:center;
         font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
         background:#f8fafc; color:#0f172a; padding:24px; text-align:center }
  .caixa { max-width:320px }
  .marca { width:64px; height:64px; border-radius:16px; margin:0 auto 20px; display:block }
  h1 { font-size:17px; margin:0 0 8px }
  p { margin:0; color:#64748b; font-size:14px }
  button { margin-top:20px; padding:10px 20px; border:0; border-radius:8px;
           background:#2563EB; color:#fff; font-size:14px; font-weight:500; cursor:pointer }
</style></head>
<body><div class="caixa">
  <img src="/brand/icon-192.png" alt="" class="marca">
  <h1>Você está sem conexão</h1>
  <p>O Organizaí precisa de internet para carregar suas tarefas. Assim que a conexão voltar, é só tentar de novo.</p>
  <button onclick="location.reload()">Tentar de novo</button>
</div></body></html>`;

self.addEventListener("fetch", (event) => {
  // Só navegações. Deixar imagens, scripts e chamadas de API passarem direto
  // evita que o service worker vire um intermediário desnecessário em tudo.
  if (event.request.mode !== "navigate") return;

  event.respondWith(
    fetch(event.request).catch(
      () =>
        new Response(PAGINA_OFFLINE, {
          status: 503,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
    ),
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Organizaí", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Organizaí";
  const options = {
    body: payload.body || "",
    icon: "/brand/favicon.png",
    badge: "/brand/favicon.png",
    // `tag` faz a notificação nova substituir a anterior do mesmo assunto,
    // em vez de empilhar cinco avisos da mesma reunião.
    tag: payload.tag || "organizai",
    renotify: true,
    data: { url: payload.url || "/dashboard" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = (event.notification.data && event.notification.data.url) || "/dashboard";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((abas) => {
      // Reaproveita uma aba já aberta do app em vez de abrir outra.
      for (const aba of abas) {
        if (aba.url.includes(self.location.origin) && "focus" in aba) {
          aba.navigate(destino);
          return aba.focus();
        }
      }
      return self.clients.openWindow(destino);
    }),
  );
});
