/**
 * Ponto de partida do servidor, executado uma vez por processo.
 *
 * Este arquivo é compilado com uma configuração de bundler que NÃO aceita
 * módulos nativos do Node (`http`, `node:module`). Por isso ele não importa
 * nada do app: o agendador apenas chama a rota de tique por HTTP, o mesmo
 * caminho que um cron externo usaria. Assim o bundle daqui fica sem Prisma e
 * sem web-push, e o comportamento é idêntico nos dois modos de operação.
 */

const INTERVALO_MS = 60_000;

export async function register(): Promise<void> {
  // Só no runtime Node: o Edge não mantém timers de longa duração.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.ENABLE_REMINDER_SCHEDULER !== "true") return;

  const segredo = process.env.CRON_SECRET;
  if (!segredo) {
    console.warn(
      "[organizai] agendador desligado: defina CRON_SECRET no .env para habilitar os lembretes.",
    );
    return;
  }

  const porta = process.env.PORT ?? "3000";
  const url = `http://127.0.0.1:${porta}/api/notifications/tick`;

  const tick = async () => {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "x-cron-secret": segredo },
      });
      if (!res.ok) return;

      const dados = (await res.json()) as { lembretes: number; inicios: number };
      if (dados.lembretes > 0 || dados.inicios > 0) {
        console.log(
          `[organizai] lembretes: ${dados.lembretes} antecipados, ${dados.inicios} de início`,
        );
      }
    } catch {
      // O servidor pode ainda não estar aceitando conexões no primeiro tique.
      // Não vale poluir o log: o próximo minuto tenta de novo.
    }
  };

  const timer = setInterval(tick, INTERVALO_MS);
  // Não segura o processo aberto na hora de encerrar.
  timer.unref?.();

  // Espera o servidor subir antes da primeira tentativa.
  setTimeout(tick, 5_000).unref?.();

  console.log("[organizai] agendador de lembretes ativo (a cada 60s)");
}
