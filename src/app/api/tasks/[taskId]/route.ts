import { updateTaskSchema } from "@/lib/validation/schemas";
import { deleteTask, updateTask } from "@/server/services/board";
import { getTaskDetail } from "@/server/services/tasks";
import { readJson, withUser } from "@/app/api/_lib/handler";

type Context = { params: Promise<{ taskId: string }> };

export const GET = withUser<Context>(async (user, _request, context) => {
  const { taskId } = await context.params;
  const task = await getTaskDetail(user.id, taskId);
  return { task };
});

export const PATCH = withUser<Context>(async (user, request, context) => {
  const { taskId } = await context.params;
  const input = updateTaskSchema.parse(await readJson(request));
  const task = await updateTask(user.id, taskId, input);
  return { task };
});

export const DELETE = withUser<Context>(async (user, _request, context) => {
  const { taskId } = await context.params;
  await deleteTask(user.id, taskId);
  return { ok: true };
});
