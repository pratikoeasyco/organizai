import { createChecklistItemSchema } from "@/lib/validation/schemas";
import { addChecklistItem } from "@/server/services/tasks";
import { readJson, withUser } from "@/app/api/_lib/handler";

type Context = { params: Promise<{ taskId: string }> };

export const POST = withUser<Context>(async (user, request, context) => {
  const { taskId } = await context.params;
  const input = createChecklistItemSchema.parse(await readJson(request));
  const item = await addChecklistItem(user.id, taskId, input.content);
  return { item };
});
