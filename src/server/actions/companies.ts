"use server";

import { revalidatePath } from "next/cache";

import { requireUserOrThrow } from "@/lib/auth/guards";
import {
  addMemberSchema,
  createCompanySchema,
  setMemberProjectsSchema,
  updateCompanySchema,
  updateMemberSchema,
} from "@/lib/validation/schemas";
import {
  addMember,
  archiveCompany,
  createCompany,
  deleteCompany,
  removeMember,
  setMemberProjects,
  updateCompany,
  updateMemberRole,
} from "@/server/services/companies";
import { type ActionState, toActionState } from "@/server/actions/types";

export async function createCompanyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requireUserOrThrow();
    const input = createCompanySchema.parse({
      name: formData.get("name"),
      slug: formData.get("slug") || undefined,
      color: formData.get("color") ?? "#2563EB",
      logoEmoji: formData.get("logoEmoji"),
    });

    const company = await createCompany(user.id, {
      name: input.name,
      slug: input.slug || undefined,
      color: input.color,
      logoEmoji: input.logoEmoji,
    });

    revalidatePath("/", "layout");

    return { ok: true, data: { id: company.id, slug: company.slug, name: company.name } };
  } catch (error) {
    return toActionState(error);
  }
}

export async function updateCompanyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requireUserOrThrow();
    const input = updateCompanySchema.parse({
      companyId: formData.get("companyId"),
      name: formData.get("name"),
      color: formData.get("color"),
      logoEmoji: formData.get("logoEmoji"),
    });

    await updateCompany(user.id, input);
    revalidatePath("/", "layout");

    return { ok: true };
  } catch (error) {
    return toActionState(error);
  }
}

export async function archiveCompanyAction(companyId: string): Promise<ActionState> {
  try {
    const user = await requireUserOrThrow();
    await archiveCompany(user.id, companyId);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    return toActionState(error);
  }
}

export async function deleteCompanyAction(companyId: string): Promise<ActionState> {
  try {
    const user = await requireUserOrThrow();
    await deleteCompany(user.id, companyId);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    return toActionState(error);
  }
}

export async function addMemberAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requireUserOrThrow();
    const input = addMemberSchema.parse({
      companyId: formData.get("companyId"),
      email: formData.get("email"),
      role: formData.get("role"),
      // O cliente manda os projetos como JSON num campo só.
      projects: JSON.parse(String(formData.get("projects") ?? "[]")),
    });

    await addMember(user.id, input);
    revalidatePath("/", "layout");

    return { ok: true };
  } catch (error) {
    return toActionState(error);
  }
}

export async function setMemberProjectsAction(
  companyId: string,
  targetUserId: string,
  projects: { projectId: string; role: string }[],
): Promise<ActionState> {
  try {
    const user = await requireUserOrThrow();
    const input = setMemberProjectsSchema.parse({
      companyId,
      userId: targetUserId,
      projects,
    });
    await setMemberProjects(user.id, input);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    return toActionState(error);
  }
}

export async function updateMemberRoleAction(
  companyId: string,
  targetUserId: string,
  role: string,
): Promise<ActionState> {
  try {
    const user = await requireUserOrThrow();
    const input = updateMemberSchema.parse({ companyId, userId: targetUserId, role });
    await updateMemberRole(user.id, input);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    return toActionState(error);
  }
}

export async function removeMemberAction(
  companyId: string,
  targetUserId: string,
): Promise<ActionState> {
  try {
    const user = await requireUserOrThrow();
    await removeMember(user.id, companyId, targetUserId);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    return toActionState(error);
  }
}
