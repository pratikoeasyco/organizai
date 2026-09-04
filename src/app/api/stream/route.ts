import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { subscribeToChanges, type ChangeEvent } from "@/server/events/bus";

/**
 * GET /api/stream — canal de atualizações ao vivo (Server-Sent Events).
 *
 * Mão única servidor → cliente, sobre HTTP comum: passa pelos mesmos cookies
 * de sessão e não exige servidor separado nem dependência nova, ao contrário
 * de WebSocket.
 *
 * O que trafega são só identificadores. O cliente usa o aviso para rebuscar os
 * dados pelas rotas normais, que já verificam permissão — então nem o conteúdo
 * nem o nome de nada passa por aqui.
 */

// Streaming exige execução dinâmica no Node.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Intervalo do "ping". Proxies costumam cortar conexões ociosas em 60s. */
const HEARTBEAT_MS = 25_000;

export async function GET(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return new Response("Não autenticado.", { status: 401 });

  // Empresas do usuário no momento da conexão. Um evento de empresa da qual
  // ele não participa é descartado antes de sair do servidor.
  const memberships = await prisma.companyMember.findMany({
    where: { userId: user.id },
    select: { companyId: true },
  });
  const companyIds = new Set(memberships.map((m) => m.companyId));

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => {
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          // Conexão já fechada pelo cliente; a limpeza acontece no cancel.
        }
      };

      // O comentário inicial abre o fluxo e derruba buffers intermediários.
      send(": conectado\n\n");
      send(`retry: 3000\n\n`);

      unsubscribe = subscribeToChanges((event: ChangeEvent) => {
        if (!companyIds.has(event.companyId)) return;
        // Quem causou já atualizou a própria tela na hora.
        if (event.actorId === user.id) return;

        send(`event: change\ndata: ${JSON.stringify(event)}\n\n`);
      });

      heartbeat = setInterval(() => send(": ping\n\n"), HEARTBEAT_MS);

      // Fechou a aba ou navegou para fora: encerra tudo.
      request.signal.addEventListener("abort", () => {
        unsubscribe?.();
        if (heartbeat) clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // já fechado
        }
      });
    },

    cancel() {
      unsubscribe?.();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Impede o nginx de segurar o fluxo em buffer.
      "X-Accel-Buffering": "no",
    },
  });
}
