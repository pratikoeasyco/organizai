import "server-only";

import { EventEmitter } from "node:events";

/**
 * Barramento de mudanças, para as telas se atualizarem sozinhas.
 *
 * O evento carrega apenas IDENTIFICADORES — nunca título, nome ou conteúdo.
 * Quem recebe usa isso só como sinal de "algo mudou aqui" e busca os dados
 * pelas rotas normais, que já verificam permissão. Assim, mesmo que um evento
 * chegue a quem não devia, não há vazamento de conteúdo.
 *
 * Limite conhecido: o barramento vive dentro do processo. Com uma instância só
 * (que é o caso em `npm run dev` e num servidor único) funciona. Rodando várias
 * instâncias, cada uma avisaria apenas os seus conectados — aí o caminho é
 * trocar este emissor por Redis pub/sub, sem mexer no resto.
 */

export type ChangeType =
  | "project.created"
  | "project.updated"
  | "project.deleted"
  | "column.changed"
  | "task.changed"
  | "event.changed"
  | "member.changed";

export interface ChangeEvent {
  type: ChangeType;
  companyId: string;
  projectId?: string;
  /** Quem causou. O cliente ignora os próprios eventos: já aplicou localmente. */
  actorId: string;
  at: number;
}

// O Next recarrega módulos em desenvolvimento; sem o global, cada recarga
// criaria um barramento novo e as conexões abertas parariam de receber.
const globalForBus = globalThis as unknown as { organizaiBus?: EventEmitter };

const bus =
  globalForBus.organizaiBus ??
  (() => {
    const emitter = new EventEmitter();
    // Uma conexão SSE por aba aberta; o padrão de 10 estoura rápido.
    emitter.setMaxListeners(0);
    globalForBus.organizaiBus = emitter;
    return emitter;
  })();

const CHANNEL = "change";

/** Publica uma mudança. Nunca lança: avisar é secundário à operação em si. */
export function emitChange(event: Omit<ChangeEvent, "at">): void {
  try {
    bus.emit(CHANNEL, { ...event, at: Date.now() } satisfies ChangeEvent);
  } catch (error) {
    console.error("[organizai] falha ao publicar mudança:", error);
  }
}

export function subscribeToChanges(listener: (event: ChangeEvent) => void): () => void {
  bus.on(CHANNEL, listener);
  return () => {
    bus.off(CHANNEL, listener);
  };
}
