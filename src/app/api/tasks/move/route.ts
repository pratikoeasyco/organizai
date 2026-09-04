import { moveTaskSchema } from "@/lib/validation/schemas";
import { moveTask } from "@/server/services/board";
import { readJson, withUser } from "@/app/api/_lib/handler";

/** POST /api/tasks/move — persiste o resultado de um drag and drop. */
export const POST = withUser(async (user, request) => {
  const input = moveTaskSchema.parse(await readJson(request));
  const task = await moveTask(user.id, input);
  return { task };
});
