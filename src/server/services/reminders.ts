import "server-only";

import { prisma } from "@/lib/db";
import { notify } from "@/server/services/notifications";
import { formatTimeRange } from "@/lib/utils/format";

/**
 * Lembretes de compromisso.
 *
 * Dois avisos por compromisso com horário:
 *  1. `reminderMinutes` antes do início (a pessoa escolhe quanto)
 *  2. na hora exata do início
 *
 * Cada um é marcado com um carimbo depois de enviado, então o agendador pode
 * rodar de minuto em minuto sem repetir aviso. Se o servidor ficou desligado e
 * a hora passou, o aviso ainda sai — atrasado, mas sai — desde que dentro da
 * janela de tolerância. Passou disso, é ruído e não vale mais a pena.
 */
const TOLERANCIA_MS = 30 * 60 * 1000;

export interface TickResult {
  lembretes: number;
  inicios: number;
}

export async function runReminderTick(now = new Date()): Promise<TickResult> {
  const [lembretes, inicios] = await Promise.all([
    enviarLembretesAntecipados(now),
    enviarAvisosDeInicio(now),
  ]);
  return { lembretes, inicios };
}

async function enviarLembretesAntecipados(now: Date): Promise<number> {
  // Maior antecedência configurável define até onde olhar para a frente.
  const candidatos = await prisma.task.findMany({
    where: {
      kind: "EVENT",
      hasTime: true,
      archivedAt: null,
      completedAt: null,
      reminderSentAt: null,
      reminderMinutes: { not: null },
      dueDate: {
        gt: new Date(now.getTime() - TOLERANCIA_MS),
        lt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      },
    },
    select: {
      id: true,
      projectId: true,
      title: true,
      dueDate: true,
      durationMinutes: true,
      reminderMinutes: true,
      assigneeId: true,
      project: { select: { name: true } },
    },
  });

  let enviados = 0;

  for (const evento of candidatos) {
    if (!evento.dueDate || !evento.reminderMinutes) continue;

    const momento = new Date(evento.dueDate.getTime() - evento.reminderMinutes * 60000);
    if (momento > now) continue; // ainda não chegou a hora de avisar
    if (now.getTime() - momento.getTime() > TOLERANCIA_MS) {
      // Muito atrasado: marca como enviado para não ficar tentando sempre.
      await prisma.task.update({
        where: { id: evento.id },
        data: { reminderSentAt: now },
      });
      continue;
    }

    await prisma.task.update({ where: { id: evento.id }, data: { reminderSentAt: now } });

    await notify({
      projectId: evento.projectId,
      type: "event.reminder",
      taskId: evento.id,
      title: evento.title,
      body: `Começa em ${descreverAntecedencia(evento.reminderMinutes)} · ${formatTimeRange(
        evento.dueDate,
        evento.durationMinutes,
      )}`,
      url: `/projetos/${evento.projectId}?vista=calendario&tarefa=${evento.id}`,
    });
    enviados += 1;
  }

  return enviados;
}

async function enviarAvisosDeInicio(now: Date): Promise<number> {
  const candidatos = await prisma.task.findMany({
    where: {
      kind: "EVENT",
      hasTime: true,
      archivedAt: null,
      completedAt: null,
      startNotifiedAt: null,
      dueDate: {
        gt: new Date(now.getTime() - TOLERANCIA_MS),
        lte: now,
      },
    },
    select: {
      id: true,
      projectId: true,
      title: true,
      dueDate: true,
      durationMinutes: true,
      project: { select: { name: true } },
    },
  });

  let enviados = 0;

  for (const evento of candidatos) {
    if (!evento.dueDate) continue;

    await prisma.task.update({ where: { id: evento.id }, data: { startNotifiedAt: now } });

    await notify({
      projectId: evento.projectId,
      type: "event.start",
      taskId: evento.id,
      title: evento.title,
      body: `Começando agora · ${formatTimeRange(evento.dueDate, evento.durationMinutes)}`,
      url: `/projetos/${evento.projectId}?vista=calendario&tarefa=${evento.id}`,
    });
    enviados += 1;
  }

  return enviados;
}

function descreverAntecedencia(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (resto === 0) return horas === 1 ? "1 hora" : `${horas} horas`;
  return `${horas}h${resto}`;
}

// O agendador em si vive em `src/instrumentation.ts`, que chama
// POST /api/notifications/tick — a mesma rota que um cron externo usaria.
// Manter o laço fora daqui evita que o bundle da instrumentação precise de
// Prisma e web-push, que ele não consegue compilar.
