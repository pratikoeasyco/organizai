import { createTaskSchema } from "@/lib/validation/schemas";
import { createTask } from "@/server/services/board";
import { readJson, withUser } from "@/app/api/_lib/handler";

/** POST /api/tasks — criação rápida a partir da coluna. */
export const POST = withUser(async (user, request) => {
  const input = createTaskSchema.parse(await readJson(request));
  const task = await createTask(user.id, input);
  return { task };
});
