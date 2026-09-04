import "server-only";

import webpush from "web-push";

import { prisma } from "@/lib/db";

/**
 * `web-push` usa `http`/`https` do Node e não pode passar pelo bundler; fica
 * em `serverExternalPackages` (next.config.ts), que cobre rotas e componentes
 * de servidor.
 *
 * O `instrumentation.ts` compila com outra configuração, que não aceita
 * módulos nativos — por isso o agendador de lá NÃO importa este arquivo: ele
 * chama a rota de tique por HTTP.
 */
type WebPush = typeof webpush;
const loadWebPush = (): WebPush => webpush;

/**
 * Motor de notificações.
 *
 * Duas responsabilidades separadas de propósito:
 *  1. decidir QUEM deve saber (audiência)
 *  2. entregar (registro no app + push no navegador)
 *
 * A entrega pode falhar — navegador offline, inscrição expirada — sem que isso
 * derrube a ação que originou o aviso. Mover um card não pode dar erro porque
 * o push de alguém falhou.
 */

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
const SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:admin@localhost";

let configured = false;
function ensureConfigured(): WebPush | null {
  if (!PUBLIC_KEY || !PRIVATE_KEY) return null;

  const webpush = loadWebPush();
  if (!webpush) return null;

  if (!configured) {
    webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
    configured = true;
  }
  return webpush;
}

export type NotificationType =
  | "task.created"
  | "task.moved"
  | "task.assigned"
  | "event.created"
  | "event.reminder"
  | "event.start";

export interface NotifyInput {
  projectId: string;
  type: NotificationType;
  title: string;
  body: string;
  taskId?: string | null;
  url?: string | null;
  /** Quem causou a ação — não recebe aviso do próprio ato. */
  actorId?: string | null;
  /** Restringe a estas pessoas (ex.: só o responsável). Sem isso, todo o time. */
  onlyUserIds?: string[];
}

/**
 * Quem enxerga um projeto: dono e admins da empresa (que acessam tudo) mais
 * quem tem acesso explícito ao projeto. Espelha `visibleProjectFilter`.
 */
export async function getProjectAudience(projectId: string): Promise<string[]> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      companyId: true,
      members: { select: { userId: true } },
      company: {
        select: {
          members: {
            where: { role: { in: ["OWNER", "ADMIN"] } },
            select: { userId: true },
          },
        },
      },
    },
  });

  if (!project) return [];

  return [
    ...new Set([
      ...project.company.members.map((m) => m.userId),
      ...project.members.map((m) => m.userId),
    ]),
  ];
}

/**
 * Aplica as regras de quem recebe: audiência do projeto, menos quem silenciou
 * ESTE projeto, menos quem causou a ação. Silenciar é individual — não afeta
 * os outros membros.
 */
export async function resolveRecipients(input: NotifyInput): Promise<string[]> {
  const audience = input.onlyUserIds ?? (await getProjectAudience(input.projectId));
  if (audience.length === 0) return [];

  const muted = await prisma.projectMute.findMany({
    where: { projectId: input.projectId, userId: { in: audience } },
    select: { userId: true },
  });
  const mutedIds = new Set(muted.map((m) => m.userId));

  return audience.filter(
    (userId) => userId !== input.actorId && !mutedIds.has(userId),
  );
}

/** Registra a notificação e tenta entregar por push. Nunca lança. */
export async function notify(input: NotifyInput): Promise<number> {
  try {
    const recipients = await resolveRecipients(input);
    if (recipients.length === 0) return 0;

    await prisma.notification.createMany({
      data: recipients.map((userId) => ({
        userId,
        projectId: input.projectId,
        taskId: input.taskId ?? null,
        type: input.type,
        title: input.title,
        body: input.body,
        url: input.url ?? null,
      })),
    });

    await sendPush(recipients, {
      title: input.title,
      body: input.body,
      url: input.url ?? "/dashboard",
      tag: `${input.type}:${input.taskId ?? input.projectId}`,
    });

    return recipients.length;
  } catch (error) {
    console.error("[organizai] falha ao notificar:", error);
    return 0;
  }
}

interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

/**
 * Envia para todos os navegadores inscritos dessas pessoas. Inscrição que o
 * serviço de push rejeita com 404/410 está morta (app desinstalado, permissão
 * revogada) e é removida — senão a tabela cresce para sempre com lixo.
 */
export async function sendPush(userIds: string[], payload: PushPayload): Promise<void> {
  const webpush = ensureConfigured();
  if (!webpush || userIds.length === 0) return;

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: { in: userIds } },
  });
  if (subscriptions.length === 0) return;

  const body = JSON.stringify(payload);
  const mortas: string[] = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
          { TTL: 60 * 60 * 12 },
        );
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) mortas.push(sub.id);
        else console.error("[organizai] push falhou:", status ?? error);
      }
    }),
  );

  if (mortas.length > 0) {
    await prisma.pushSubscription
      .deleteMany({ where: { id: { in: mortas } } })
      .catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------
// Preferência por projeto
// ---------------------------------------------------------------------------

export async function isProjectMuted(userId: string, projectId: string): Promise<boolean> {
  const mute = await prisma.projectMute.findUnique({
    where: { userId_projectId: { userId, projectId } },
    select: { userId: true },
  });
  return Boolean(mute);
}

export async function setProjectMuted(
  userId: string,
  projectId: string,
  muted: boolean,
): Promise<void> {
  if (muted) {
    await prisma.projectMute.upsert({
      where: { userId_projectId: { userId, projectId } },
      create: { userId, projectId },
      update: {},
    });
  } else {
    await prisma.projectMute.deleteMany({ where: { userId, projectId } });
  }
}

// ---------------------------------------------------------------------------
// Inscrições de push
// ---------------------------------------------------------------------------

export async function saveSubscription(
  userId: string,
  input: { endpoint: string; p256dh: string; auth: string; userAgent?: string | null },
): Promise<void> {
  await prisma.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    create: {
      userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent?.slice(0, 255) ?? null,
    },
    // O mesmo endpoint pode reaparecer para outra conta no mesmo navegador.
    update: { userId, p256dh: input.p256dh, auth: input.auth, lastUsedAt: new Date() },
  });
}

export async function removeSubscription(endpoint: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

// ---------------------------------------------------------------------------
// Caixa de entrada
// ---------------------------------------------------------------------------

export interface NotificationEntry {
  id: string;
  type: string;
  title: string;
  body: string;
  url: string | null;
  readAt: string | null;
  createdAt: string;
}

export async function listNotifications(
  userId: string,
  limit = 20,
): Promise<NotificationEntry[]> {
  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    url: row.url,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function countUnread(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function markAllRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}
