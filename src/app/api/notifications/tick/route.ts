import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { runReminderTick } from "@/server/services/reminders";

/**
 * POST /api/notifications/tick — roda uma passada do agendador de lembretes.
 *
 * Existe por dois motivos:
 *  - hospedagem sem processo permanente (Vercel e afins) aponta um cron aqui e
 *    desliga o agendador interno (ENABLE_REMINDER_SCHEDULER=false);
 *  - dá para verificar o comportamento sem esperar o relógio virar.
 *
 * Protegido por segredo compartilhado OU por sessão de admin da plataforma.
 * Sem nenhum dos dois, responde 404 — não confirma nem que a rota existe.
 */
export async function POST(request: Request): Promise<Response> {
  const segredo = process.env.CRON_SECRET;
  const enviado = request.headers.get("x-cron-secret");

  let autorizado = Boolean(segredo && enviado && segredo === enviado);

  if (!autorizado) {
    const user = await getCurrentUser();
    autorizado = Boolean(user?.isPlatformAdmin);
  }

  if (!autorizado) {
    return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  }

  const resultado = await runReminderTick();
  return NextResponse.json(resultado);
}
