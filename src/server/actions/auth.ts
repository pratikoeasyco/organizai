"use server";

import { createHash, randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  createSession,
  destroySession,
  getCurrentUser,
  pruneExpired,
} from "@/lib/auth/session";
import { AppError } from "@/lib/auth/guards";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from "@/lib/validation/schemas";
import { colorFromString } from "@/lib/utils/colors";
import { type ActionState, toActionState } from "@/server/actions/types";

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hora

function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// ---------------------------------------------------------------------------

export async function registerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const input = registerSchema.parse({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
    });

    const existing = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (existing) {
      throw new AppError("Já existe uma conta com este e-mail.", 409);
    }

    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash: await hashPassword(input.password),
        avatarColor: colorFromString(input.email),
      },
      select: { id: true },
    });

    const userAgent = (await headers()).get("user-agent");
    await createSession(user.id, userAgent);
  } catch (error) {
    return toActionState(error);
  }

  // Conta nova sempre passa pelo onboarding.
  redirect("/comecar");
}

export async function loginAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let destination: string;

  try {
    const input = loginSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    const user = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true, passwordHash: true },
    });

    // Mensagem idêntica para e-mail inexistente e senha errada — não revela
    // quais e-mails têm conta.
    const generic = "E-mail ou senha incorretos.";
    if (!user) {
      // Custo artificial para não expor a existência da conta pelo tempo de resposta.
      await hashPassword(input.password);
      throw new AppError(generic, 401);
    }

    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) throw new AppError(generic, 401);

    await pruneExpired();
    const userAgent = (await headers()).get("user-agent");
    await createSession(user.id, userAgent);

    const companyCount = await prisma.companyMember.count({ where: { userId: user.id } });
    destination = companyCount === 0 ? "/comecar" : "/dashboard";
  } catch (error) {
    return toActionState(error);
  }

  redirect(destination);
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

// ---------------------------------------------------------------------------
// Recuperação de senha
// ---------------------------------------------------------------------------

/**
 * Não há serviço de e-mail no MVP: o link de redefinição é devolvido para a
 * própria tela, de forma explícita. Independentemente do e-mail existir ou não,
 * a resposta é sempre de sucesso — não revela contas cadastradas.
 */
export async function forgotPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const { email } = forgotPasswordSchema.parse({ email: formData.get("email") });

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!user) {
      return { ok: true, data: { resetPath: null } };
    }

    const token = randomBytes(32).toString("base64url");
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashResetToken(token),
        expiresAt: new Date(Date.now() + RESET_TTL_MS),
      },
    });

    return { ok: true, data: { resetPath: `/redefinir-senha?token=${token}` } };
  } catch (error) {
    return toActionState(error);
  }
}

export async function resetPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const input = resetPasswordSchema.parse({
      token: formData.get("token"),
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword"),
    });

    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashResetToken(input.token) },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });

    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      throw new AppError("Este link expirou ou já foi utilizado.", 400);
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: await hashPassword(input.password) },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      // Encerra todas as sessões abertas após troca de senha.
      prisma.session.deleteMany({ where: { userId: record.userId } }),
    ]);

    return { ok: true };
  } catch (error) {
    return toActionState(error);
  }
}

// ---------------------------------------------------------------------------
// Perfil
// ---------------------------------------------------------------------------

export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AppError("Sessão expirada.", 401);

    const input = updateProfileSchema.parse({
      name: formData.get("name"),
      jobTitle: formData.get("jobTitle"),
      avatarColor: formData.get("avatarColor"),
    });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        name: input.name,
        jobTitle: input.jobTitle ?? null,
        avatarColor: input.avatarColor,
      },
    });

    return { ok: true };
  } catch (error) {
    return toActionState(error);
  }
}

export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) throw new AppError("Sessão expirada.", 401);

    const input = changePasswordSchema.parse({
      currentPassword: formData.get("currentPassword"),
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword"),
    });

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: sessionUser.id },
      select: { passwordHash: true },
    });

    const valid = await verifyPassword(input.currentPassword, user.passwordHash);
    if (!valid) {
      return { ok: false, fieldErrors: { currentPassword: "Senha atual incorreta." } };
    }

    await prisma.user.update({
      where: { id: sessionUser.id },
      data: { passwordHash: await hashPassword(input.password) },
    });

    return { ok: true };
  } catch (error) {
    return toActionState(error);
  }
}
