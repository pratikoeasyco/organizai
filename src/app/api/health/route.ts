import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/health — verificação de saúde para o Easypanel.
 *
 * Confere o que realmente importa para o app responder: o banco está
 * acessível? Um health check que só devolve "ok" sem tocar no banco mantém no
 * ar um container que na prática não funciona.
 *
 * Não exige autenticação e não expõe nada: só o estado da conexão.
 */
export async function GET(): Promise<Response> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "ok" });
  } catch {
    return NextResponse.json(
      { status: "erro", database: "indisponível" },
      { status: 503 },
    );
  }
}
