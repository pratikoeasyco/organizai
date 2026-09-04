import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError } from "@/lib/errors";
import { requireUserOrThrow } from "@/lib/auth/guards";
import type { SessionUser } from "@/lib/auth/session";

/**
 * Envolve um route handler: garante sessão, normaliza erros e evita repetir
 * try/catch em todas as rotas do quadro.
 */
export function withUser<T>(
  fn: (user: SessionUser, request: Request, context: T) => Promise<unknown>,
) {
  return async (request: Request, context: T): Promise<Response> => {
    try {
      const user = await requireUserOrThrow();
      const data = await fn(user, request, context);
      return NextResponse.json(data ?? { ok: true });
    } catch (error) {
      if (error instanceof ZodError) {
        const first = error.issues[0];
        return NextResponse.json(
          { error: first?.message ?? "Dados inválidos.", issues: error.issues },
          { status: 422 },
        );
      }
      if (error instanceof AppError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      console.error("[organizai] erro inesperado em route handler:", error);
      return NextResponse.json({ error: "Algo deu errado. Tente novamente." }, { status: 500 });
    }
  };
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AppError("Corpo da requisição inválido.", 400);
  }
}
