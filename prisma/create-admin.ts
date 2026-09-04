/**
 * Cria (ou promove) a conta de administrador da plataforma.
 *
 * Execute com: npm run db:create-admin
 *
 * Aceita e-mail e senha por variável de ambiente; sem elas, usa o padrão de
 * desenvolvimento. Rodar de novo com o mesmo e-mail apenas garante que a conta
 * seja administradora — não sobrescreve a senha, para não desfazer uma troca
 * feita depois pelo próprio usuário.
 */
import { PrismaClient } from "@prisma/client";

import { hashPassword } from "../src/lib/auth/password.ts";

const prisma = new PrismaClient();

const EMAIL = (process.env.ADMIN_EMAIL ?? "admin@admin.com").toLowerCase();
const PASSWORD = process.env.ADMIN_PASSWORD ?? "Gemeos123";
const NAME = process.env.ADMIN_NAME ?? "Administrador";

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: EMAIL } });

  if (existing) {
    if (existing.isPlatformAdmin) {
      console.log(`${EMAIL} já é administrador da plataforma. Nada a fazer.`);
      return;
    }
    await prisma.user.update({
      where: { id: existing.id },
      data: { isPlatformAdmin: true },
    });
    console.log(`Conta existente ${EMAIL} promovida a administradora.`);
    return;
  }

  await prisma.user.create({
    data: {
      name: NAME,
      email: EMAIL,
      passwordHash: await hashPassword(PASSWORD),
      avatarColor: "#111827",
      jobTitle: "Administrador da plataforma",
      isPlatformAdmin: true,
    },
  });

  console.log("Conta de administrador criada:");
  console.log(`  e-mail: ${EMAIL}`);
  console.log(`  senha:  ${PASSWORD}`);
  console.log("\nAcesse o painel em /admin depois de entrar.");
  console.log("Troque esta senha antes de colocar a plataforma no ar.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
