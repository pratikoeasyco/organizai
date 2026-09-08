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
 * Que prioridade um card assume ao ser solto em `indice` de uma coluna.
 *
 * É isto que dá sentido ao arraste: como a lista é ordenada por prioridade,
 * soltar entre dois cards urgentes só pode significar "isto também é urgente".
 * Sem esta regra o card voltaria sozinho para o seu bloco, o que parece defeito.
 *
 * Devolve null quando a prioridade não deve mudar: coluna de concluído, ou
 * quando o card foi solto dentro do próprio bloco.
 */
export function priorityAtDrop<T extends OrderableTask>(
  tasks: T[],
  indice: number,
  atual: Priority,
  isDone: boolean,
): Priority | null {
  if (isDone) return null;

  const vizinhos = tasks.filter((_, i) => i !== indice);
  const anterior = vizinhos[indice - 1]?.priority;
  const seguinte = vizinhos[indice]?.priority;

  // Entre dois cards da mesma prioridade, ou encostado em um só: assume a dele.
  const alvo = anterior && seguinte
    ? PRIORITY_META[anterior].rank >= PRIORITY_META[seguinte].rank
      ? anterior
      : seguinte
    : (anterior ?? seguinte);

  if (!alvo || alvo === atual) return null;
  return alvo;
}
