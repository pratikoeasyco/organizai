import { PRIORITY_META, type Priority } from "@/types/domain";

/**
 * Ordem dos cards dentro de uma coluna.
 *
 * A regra vive aqui, sozinha, porque servidor e navegador precisam chegar
 * exatamente ao mesmo resultado: o servidor ordena o que envia, e o quadro
 * reordena localmente durante o arraste, antes de qualquer resposta chegar. Se
 * as duas versões divergirem, o card "pula" ao soltar.
 */

export interface OrderableTask {
  priority: Priority;
  position: number;
  lastMovedAt: string | Date | null;
  updatedAt: string | Date;
}

function tempo(valor: string | Date | null | undefined): number {
  if (!valor) return 0;
  const data = valor instanceof Date ? valor : new Date(valor);
  const ms = data.getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * Coluna comum: mais urgente em cima. Dentro da mesma prioridade vale a ordem
 * manual — arrastar continua servindo para priorizar entre iguais.
 *
 * Última coluna (concluído): a prioridade deixa de importar, porque a tarefa
 * acabou. Ordena pelo momento em que chegou ali, mais recente no topo, que é a
 * pergunta que se faz de uma lista de concluídos ("o que saiu agora?").
 */
export function sortColumnTasks<T extends OrderableTask>(tasks: T[], isDone: boolean): T[] {
  const copia = [...tasks];

  if (isDone) {
    copia.sort((a, b) => {
      const diferenca = chegadaEm(b) - chegadaEm(a);
      return diferenca !== 0 ? diferenca : a.position - b.position;
    });
    return copia;
  }

  copia.sort((a, b) => {
    const porPrioridade = PRIORITY_META[b.priority].rank - PRIORITY_META[a.priority].rank;
    return porPrioridade !== 0 ? porPrioridade : a.position - b.position;
  });
  return copia;
}

/** Quando o card chegou nesta coluna. Sem registro de movimentação, usa a
 *  última alteração — é o melhor que existe para tarefas antigas. */
function chegadaEm(task: OrderableTask): number {
  return tempo(task.lastMovedAt) || tempo(task.updatedAt);
}

/**
 * Onde o card PODE parar, dado que a coluna é ordenada por prioridade.
 *
 * Um card urgente não entra no meio das moderadas, nem uma baixa sobe para o
 * meio das urgentes: a posição de destino é presa ao bloco da própria
 * prioridade. Arrastar reordena entre iguais; mudar de prioridade é decisão
 * deliberada, feita no campo Prioridade do painel da tarefa.
 *
 * `tasks` é a lista da coluna de destino já ordenada e SEM o card arrastado.
 * Na coluna de concluído não há bloco: a prioridade deixou de valer ali.
 */
export function clampToPriorityBlock<T extends OrderableTask>(
  tasks: T[],
  indice: number,
  priority: Priority,
  isDone: boolean,
): number {
  if (isDone) return indice;

  const meu = PRIORITY_META[priority].rank;
  // Com a lista ordenada, tudo que é mais urgente vem antes do bloco e tudo que
  // é menos urgente vem depois — então as bordas são só duas contagens.
  const inicio = tasks.filter((t) => PRIORITY_META[t.priority].rank > meu).length;
  const fim = inicio + tasks.filter((t) => PRIORITY_META[t.priority].rank === meu).length;

  if (indice < inicio) return inicio;
  if (indice > fim) return fim;
  return indice;
}
