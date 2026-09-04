import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";

import { prisma } from "@/lib/db";

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "organizai_session";
const TTL_DAYS = Number(process.env.SESSION_TTL_DAYS) || 30;
const TTL_MS = TTL_DAYS * 24 * 60 * 60 * 1000;

/**
 * O cookie dura muito mais que a sessão de propósito.
 *
 * Quem manda é o registro no banco; o cookie é só o portador do token. Se o
 * cookie expirasse junto, o app deslogaria sozinho ao completar o prazo —
 * exatamente o que não pode acontecer num PWA instalado, que a pessoa espera
 * abrir e já estar dentro.
 */
const COOKIE_MAX_AGE_MS = 400 * 24 * 60 * 60 * 1000;

/**
 * Renova a validade quando falta menos de um terço do prazo. Sem isso, quem usa
 * todo dia seria deslogado no trigésimo dia; com isso, o acesso se estende
 * enquanto houver uso — e expira de fato se ficar parado o período inteiro.
 */
const RENEW_THRESHOLD_MS = TTL_MS / 3;

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;

/** O banco guarda apenas o hash do token — vazar a tabela não vaza sessões. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  jobTitle: string | null;
  /** Acesso ao painel /admin. Verificado no servidor a cada requisição. */
  isPlatformAdmin: boolean;
}

export async function createSession(userId: string, userAgent?: string | null): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_MS);

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      userAgent: userAgent?.slice(0, 255) ?? null,
    },
  });

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    ...COOKIE_OPTIONS,
    expires: new Date(Date.now() + COOKIE_MAX_AGE_MS),
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;

  if (token) {
    await prisma.session
      .deleteMany({ where: { tokenHash: hashToken(token) } })
      .catch(() => undefined);
  }

  store.delete(COOKIE_NAME);
}

/**
 * Lê o usuário da sessão atual. `cache` deduplica a consulta dentro do mesmo
 * render — layout, página e componentes compartilham uma única query.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      expiresAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarColor: true,
          jobTitle: true,
          isPlatformAdmin: true,
        },
      },
    },
  });

  if (!session) return null;

  const agora = Date.now();
  if (session.expiresAt.getTime() < agora) {
    await prisma.session.deleteMany({ where: { tokenHash } }).catch(() => undefined);
    return null;
  }

  // Renovação deslizante. É só uma escrita no banco — não mexe no cookie, que
  // já dura bem mais e não pode ser alterado durante a renderização.
  if (session.expiresAt.getTime() - agora < RENEW_THRESHOLD_MS) {
    await prisma.session
      .update({
        where: { id: session.id },
        data: { expiresAt: new Date(agora + TTL_MS) },
      })
      .catch(() => undefined);
  }

  return session.user;
});

/** Remove sessões e tokens de recuperação expirados (chamado no login). */
export async function pruneExpired(): Promise<void> {
  const now = new Date();
  await Promise.all([
    prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: now } } }),
  ]).catch(() => undefined);
}

export { hashToken, COOKIE_NAME };
