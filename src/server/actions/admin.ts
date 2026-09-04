"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePlatformAdminOrThrow } from "@/lib/auth/guards";
import { emailSchema, nameSchema } from "@/lib/validation/schemas";
import {
  deleteUser,
  revokeSessions,
  setPlatformAdmin,
  updateUser,
} from "@/server/services/admin";
import { type ActionState, toActionState } from "@/server/actions/types";

const updateUserSchema = z.object({
  userId: z.string().min(1).max(64),
  name: nameSchema,
  email: emailSchema,
  jobTitle: z
    .string()
    .max(80)
    .transform((v) => v.trim())
    .transform((v) => (v.length === 0 ? null : v))
    .nullable()
    .optional(),
  avatarColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida.")
    .transform((v) => v.toUpperCase()),
});

export async function updateUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    // Cada action revalida o acesso: a página ter carregado não é garantia.
    await requirePlatformAdminOrThrow();

    const input = updateUserSchema.parse({
      userId: formData.get("userId"),
      name: formData.get("name"),
      email: formData.get("email"),
      jobTitle: formData.get("jobTitle"),
      avatarColor: formData.get("avatarColor"),
    });

    await updateUser({
      userId: input.userId,
      name: input.name,
      email: input.email,
      jobTitle: input.jobTitle ?? null,
      avatarColor: input.avatarColor,
    });

    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (error) {
    return toActionState(error);
  }
}

export async function setPlatformAdminAction(
  userId: string,
  isAdmin: boolean,
): Promise<ActionState> {
  try {
    const actor = await requirePlatformAdminOrThrow();
    await setPlatformAdmin(actor.id, userId, isAdmin);
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (error) {
    return toActionState(error);
  }
}

export async function revokeSessionsAction(userId: string): Promise<ActionState> {
  try {
    await requirePlatformAdminOrThrow();
    const count = await revokeSessions(userId);
    revalidatePath("/admin", "layout");
    return { ok: true, data: { count } };
  } catch (error) {
    return toActionState(error);
  }
}

export async function deleteUserAction(userId: string): Promise<ActionState> {
  try {
    const actor = await requirePlatformAdminOrThrow();
    await deleteUser(actor.id, userId);
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (error) {
    return toActionState(error);
  }
}
