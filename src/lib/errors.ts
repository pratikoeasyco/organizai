/**
 * Erro de domínio compartilhado. Fica fora de `lib/auth/guards` de propósito:
 * componentes de cliente precisam identificá-lo ao tratar respostas, e guards
 * é um módulo `server-only`.
 */
export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const notFound = () => new AppError("Recurso não encontrado.", 404);

export const forbidden = (message = "Você não tem permissão para esta ação.") =>
  new AppError(message, 403);

export const unauthorized = () => new AppError("Sessão expirada. Entre novamente.", 401);
