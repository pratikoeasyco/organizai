import { ZodError } from "zod";

import { AppError } from "@/lib/errors";

/** Resultado padrão de todas as server actions consumidas por formulários. */
export interface ActionState {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Payload livre por action (id criado, token gerado etc.). */
  data?: Record<string, unknown>;
}

export const IDLE: ActionState = { ok: false };

/**
 * Traduz erros conhecidos em `ActionState`. Erros inesperados viram uma
 * mensagem genérica — detalhes internos ficam no log do servidor.
 */
export function toActionState(error: unknown): ActionState {
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return {
      ok: false,
      error: "Verifique os campos destacados.",
      fieldErrors,
    };
  }

  if (error instanceof AppError) {
    return { ok: false, error: error.message };
  }

  console.error("[organizai] erro inesperado em server action:", error);
  return { ok: false, error: "Algo deu errado. Tente novamente." };
}
