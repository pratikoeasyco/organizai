/**
 * Migra a prioridade das tarefas do modelo antigo (5 níveis) para o novo (3).
 *
 *   NONE -> LOW      (nível mais baixo absorve "sem prioridade")
 *   HIGH -> URGENT   (não havia distinção prática entre "alta" e "urgente")
 *
 * Idempotente: rodar de novo não altera nada.
 * Execute com: npm run db:migrate-priorities
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const MAPPING: Record<string, string> = {
  NONE: "LOW",
  HIGH: "URGENT",
};

async function main() {
  let total = 0;

  for (const [from, to] of Object.entries(MAPPING)) {
    const { count } = await prisma.task.updateMany({
      where: { priority: from },
      data: { priority: to },
    });
    if (count > 0) console.log(`  ${from} -> ${to}: ${count} tarefa(s)`);
    total += count;
  }

  // Qualquer valor fora do conjunto novo vira o nível mais baixo.
  const { count: orphans } = await prisma.task.updateMany({
    where: { priority: { notIn: ["LOW", "MEDIUM", "URGENT"] } },
    data: { priority: "LOW" },
  });
  if (orphans > 0) console.log(`  valores desconhecidos -> LOW: ${orphans} tarefa(s)`);

  console.log(
    total + orphans === 0
      ? "Nada a migrar: todas as tarefas já usam os três níveis."
      : `Migração concluída: ${total + orphans} tarefa(s) atualizadas.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
