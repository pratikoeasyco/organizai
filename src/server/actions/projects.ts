"use server";

import { revalidatePath } from "next/cache";

import { requireUserOrThrow } from "@/lib/auth/guards";
import { createProjectSchema, updateProjectSchema } from "@/lib/validation/schemas";
import {
  createProject,
  deleteProject,
  setProjectArchived,
  touchRecentProject,
  updateProject,
} from "@/server/services/projects";
import { type ActionState, toActionState } from "@/server/actions/types";

export async function createProjectAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requireUserOrThrow();
    const input = createProjectSchema.parse({
      companyId: formData.get("companyId"),
      name: formData.get("name"),
      description: formData.get("description"),
      color: formData.get("color") ?? "#2563EB",
      icon: formData.get("icon"),
      template: formData.get("template") ?? "basic",
    });

    const project = await createProject(user.id, input);
    revalidatePath("/", "layout");

    return { ok: true, data: { id: project.id, name: project.name } };
  } catch (error) {
    return toActionState(error);
  }
}

export async function updateProjectAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requireUserOrThrow();
    const input = updateProjectSchema.parse({
      projectId: formData.get("projectId"),
      name: formData.get("name"),
      description: formData.get("description"),
      color: formData.get("color"),
      icon: formData.get("icon"),
    });

    await updateProject(user.id, input);
    revalidatePath("/", "layout");

    return { ok: true };
  } catch (error) {
    return toActionState(error);
  }
}

export async function setProjectArchivedAction(
  projectId: string,
  archived: boolean,
): Promise<ActionState> {
  try {
    const user = await requireUserOrThrow();
    await setProjectArchived(user.id, projectId, archived);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    return toActionState(error);
  }
}

export async function deleteProjectAction(projectId: string): Promise<ActionState> {
  try {
    const user = await requireUserOrThrow();
    await deleteProject(user.id, projectId);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    return toActionState(error);
  }
}

/** Registra a visita para alimentar "Projetos recentes" no dashboard. */
export async function touchProjectAction(projectId: string): Promise<void> {
  try {
    const user = await requireUserOrThrow();
    await touchRecentProject(user.id, projectId);
  } catch {
    // navegação não deve falhar por causa do histórico
  }
}
