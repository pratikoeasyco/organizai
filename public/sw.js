/**
 * Service worker do Organizaí.
 *
 * Faz duas coisas, de propósito nada além disso:
 *  1. recebe push e mostra a notificação
 *  2. leva ao lugar certo quando a pessoa clica
 *
 * Não há cache offline aqui. Um cache mal feito serve tela velha e é pior que
 * não ter cache nenhum — isso entra depois, com cuidado.
 */

self.addEventListener("install", () => {
  // Assume o controle sem esperar as abas antigas fecharem.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
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
