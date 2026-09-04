/**
 * Popula o banco com uma conta de demonstração.
 * Execute com: npm run db:seed
 *
 * Credenciais geradas:
 *   e-mail: demo@organizai.app
 *   senha:  organizai123
 */
import { PrismaClient } from "@prisma/client";

import { hashPassword } from "../src/lib/auth/password.ts";

const prisma = new PrismaClient();

const DEMO_EMAIL = "demo@organizai.app";
const DEMO_PASSWORD = "organizai123";

function daysFromNow(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(12, 0, 0, 0);
  return date;
}

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (existing) {
    console.log("Conta de demonstração já existe. Nada a fazer.");
    return;
  }

  const user = await prisma.user.create({
    data: {
      name: "Ana Ribeiro",
      email: DEMO_EMAIL,
      passwordHash: await hashPassword(DEMO_PASSWORD),
      avatarColor: "#2563EB",
      jobTitle: "Gerente de projetos",
    },
  });

  const colleague = await prisma.user.create({
    data: {
      name: "Bruno Lima",
      email: "bruno@organizai.app",
      passwordHash: await hashPassword(DEMO_PASSWORD),
      avatarColor: "#10B981",
    },
  });

  const acme = await prisma.company.create({
    data: {
      name: "Acme",
      slug: "acme",
      color: "#2563EB",
      logoEmoji: "🚀",
      ownerId: user.id,
      members: {
        create: [
          { userId: user.id, role: "OWNER" },
          { userId: colleague.id, role: "MEMBER" },
        ],
      },
    },
  });

  await prisma.company.create({
    data: {
      name: "Estúdio Norte",
      slug: "estudio-norte",
      color: "#A855F7",
      logoEmoji: "🎨",
      ownerId: user.id,
      members: { create: { userId: user.id, role: "OWNER" } },
      projects: {
        create: {
          name: "Site institucional",
          description: "Redesign completo do site.",
          color: "#A855F7",
          icon: "🌐",
          createdById: user.id,
          columns: {
            create: [
              { name: "Ideias", color: "#A855F7", position: 0 },
              { name: "Em produção", color: "#2563EB", position: 1 },
              { name: "Publicado", color: "#10B981", position: 2 },
            ],
          },
        },
      },
    },
  });

  const marketing = await prisma.project.create({
    data: {
      companyId: acme.id,
      name: "Marketing",
      description: "Campanhas, conteúdo e lançamentos.",
      color: "#2563EB",
      icon: "📣",
      createdById: user.id,
      columns: {
        create: [
          { name: "Backlog", color: "#94A3B8", position: 0 },
          { name: "Em andamento", color: "#2563EB", position: 1 },
          { name: "Em revisão", color: "#F59E0B", position: 2 },
          { name: "Concluído", color: "#10B981", position: 3 },
        ],
      },
      labels: {
        create: [
          { name: "Website", color: "#2563EB" },
          { name: "Campanha", color: "#EC4899" },
          { name: "Urgente", color: "#EF4444" },
        ],
      },
    },
    include: { columns: { orderBy: { position: "asc" } }, labels: true },
  });

  const [backlog, andamento, revisao, concluido] = marketing.columns;
  const [website, campanha] = marketing.labels;

  const tasks: {
    columnId: string;
    title: string;
    priority: string;
    dueDate?: Date;
    assigneeId?: string;
    labelIds?: string[];
    description?: string;
  }[] = [
    {
      columnId: backlog.id,
      title: "Levantar concorrentes do setor",
      priority: "LOW",
    },
    {
      columnId: backlog.id,
      title: "Definir personas da campanha de fim de ano",
      priority: "MEDIUM",
      labelIds: [campanha.id],
      description: "Mapear as três personas principais com base nos dados de venda.",
    },
    {
      columnId: andamento.id,
      title: "Criar landing page da nova campanha",
      priority: "URGENT",
      dueDate: daysFromNow(3),
      assigneeId: user.id,
      labelIds: [website.id, campanha.id],
      description: "Criar uma landing page para a nova campanha, com formulário de captura.",
    },
    {
      columnId: andamento.id,
      title: "Escrever copy dos anúncios",
      priority: "MEDIUM",
      dueDate: daysFromNow(-1),
      assigneeId: colleague.id,
      labelIds: [campanha.id],
    },
    {
      columnId: revisao.id,
      title: "Revisar identidade visual do e-mail",
      priority: "URGENT",
      dueDate: daysFromNow(0),
      assigneeId: user.id,
    },
    {
      columnId: concluido.id,
      title: "Aprovar orçamento de mídia",
      priority: "LOW",
      assigneeId: user.id,
    },
    {
      columnId: concluido.id,
      title: "Fechar contrato com a agência",
      priority: "LOW",
    },
  ];

  const positions = new Map<string, number>();

  for (const task of tasks) {
    const position = positions.get(task.columnId) ?? 0;
    positions.set(task.columnId, position + 1);

    const created = await prisma.task.create({
      data: {
        projectId: marketing.id,
        columnId: task.columnId,
        title: task.title,
        description: task.description ?? null,
        priority: task.priority,
        dueDate: task.dueDate ?? null,
        assigneeId: task.assigneeId ?? null,
        createdById: user.id,
        position,
        labels: task.labelIds
          ? { create: task.labelIds.map((labelId) => ({ labelId })) }
          : undefined,
      },
    });

    await prisma.activity.create({
      data: {
        companyId: acme.id,
        projectId: marketing.id,
        taskId: created.id,
        actorId: user.id,
        type: "task.created",
        message: `criou a tarefa ${created.title}`,
      },
    });
  }

  // Checklist e comentário na tarefa principal
  const landing = await prisma.task.findFirstOrThrow({
    where: { projectId: marketing.id, title: { startsWith: "Criar landing page" } },
  });

  await prisma.checklistItem.createMany({
    data: [
      { taskId: landing.id, content: "Criar wireframe", done: true, position: 0 },
      { taskId: landing.id, content: "Aprovar copy", done: true, position: 1 },
      { taskId: landing.id, content: "Desenvolver página", done: false, position: 2 },
      { taskId: landing.id, content: "Publicar", done: false, position: 3 },
    ],
  });

  await prisma.taskComment.create({
    data: {
      taskId: landing.id,
      authorId: colleague.id,
      body: "Precisamos finalizar até sexta para entrar no calendário de mídia.",
    },
  });

  await prisma.project.create({
    data: {
      companyId: acme.id,
      name: "Desenvolvimento",
      description: "Produto e infraestrutura.",
      color: "#0EA5E9",
      icon: "🛠",
      position: 1,
      createdById: user.id,
      columns: {
        create: [
          { name: "A fazer", color: "#94A3B8", position: 0 },
          { name: "Fazendo", color: "#0EA5E9", position: 1 },
          { name: "Testes", color: "#F59E0B", position: 2 },
          { name: "Produção", color: "#10B981", position: 3 },
        ],
      },
    },
  });

  await prisma.activity.create({
    data: {
      companyId: acme.id,
      actorId: user.id,
      type: "company.created",
      message: "criou a empresa Acme",
    },
  });

  console.log("Conta de demonstração criada:");
  console.log(`  e-mail: ${DEMO_EMAIL}`);
  console.log(`  senha:  ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
