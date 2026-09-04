import { createCommentSchema } from "@/lib/validation/schemas";
import { addComment } from "@/server/services/tasks";
import { readJson, withUser } from "@/app/api/_lib/handler";

type Context = { params: Promise<{ taskId: string }> };

export const POST = withUser<Context>(async (user, request, context) => {
  const { taskId } = await context.params;
  const input = createCommentSchema.parse(await readJson(request));
  const comment = await addComment(user.id, taskId, input.body);
  return { comment };
});
