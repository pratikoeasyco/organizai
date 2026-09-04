import { PrismaClient } from "@prisma/client";

// Em desenvolvimento o Next recarrega módulos a cada alteração; o singleton
// evita esgotar as conexões do SQLite com múltiplas instâncias do client.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
