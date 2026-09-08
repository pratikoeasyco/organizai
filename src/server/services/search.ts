import "server-only";

import { prisma } from "@/lib/db";
import { visibleProjectFilter } from "@/lib/auth/guards";
import type { Priority } from "@/types/domain";

/**
 * Busca de tarefas em todos os projetos que a pessoa enxerga.
 *
 * A busca do quadro filtra o quadro aberto; esta responde a outra pergunta —
 * "onde está aquela tarefa?" —, que é justamente quando não se sabe em qual
 * projeto procurar.
 */

export interface SearchHit {
  id: string;
  title: string;
  /** TASK vive no quadro, EVENT no calendário — o destino do clique muda. */
  kind: "TASK" | "EVENT";
  priority: Priority;
  dueDate: string | null;
  hasTime: boolean;
  done: boolean;
  columnName: string | null;
  projectId: string;
  projectName: string;
  projectColor: string;
  companyName: string;
}

const LIMITE = 20;

export async function searchTasks(userId: string, termo: string): Promise<SearchHit[]> {
  const busca = termo.trim();
  // Uma letra só traria quase o quadro inteiro e não ajudaria ninguém.
  if (busca.length < 2) return [];

  const tarefas = await prisma.task.findMany({
    where: {
      archivedAt: null,
      // O isolamento entre empresas vale aqui como em qualquer outro lugar:
      // só entram projetos que esta pessoa já poderia abrir.
      project: { archivedAt: null, ...visibleProjectFilter(userId) },
      OR: [
        // `insensitive` é obrigatório no PostgreSQL — sem ele, procurar por
        // "reunião" não acharia "Reunião".
        { title: { contains: busca, mode: "insensitive" } },
        { description: { contains: busca, mode: "insensitive" } },
      ],
    },
    // Mexidas recentes primeiro: quem procura costuma querer o que tocou por
    // último, não o mais antigo.
    orderBy: [{ updatedAt: "desc" }],
    take: LIMITE,
    select: {
      id: true,
      title: true,
      kind: true,
      priority: true,
      dueDate: true,
      hasTime: true,
      column: {
        select: {
          id: true,
          name: true,
          position: true,
          project: { select: { columns: { where: { archivedAt: null }, select: { id: true }, orderBy: { position: "asc" } } } },
        },
      },
      project: {
        select: {
          id: true,
          name: true,
          color: true,
          company: { select: { name: true } },
        },
      },
    },
  });

  return tarefas.map((task) => {
    const colunas = task.column?.project.columns ?? [];
    // "Concluída" continua sendo posicional: estar na última coluna. Com uma
    // coluna só, nada conta como concluído — mesma regra do quadro.
    const done =
      Boolean(task.column) &&
      colunas.length > 1 &&
      colunas[colunas.length - 1]?.id === task.column?.id;

    return {
      id: task.id,
      title: task.title,
      kind: task.kind as "TASK" | "EVENT",
      priority: task.priority as Priority,
      dueDate: task.dueDate ? task.dueDate.toISOString() : null,
      hasTime: task.hasTime,
      done,
      columnName: task.column?.name ?? null,
      projectId: task.project.id,
      projectName: task.project.name,
      projectColor: task.project.color,
      companyName: task.project.company.name,
    };
  });
}
