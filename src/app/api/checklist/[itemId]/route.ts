import { updateChecklistItemSchema } from "@/lib/validation/schemas";
import { deleteChecklistItem, updateChecklistItem } from "@/server/services/tasks";
import { readJson, withUser } from "@/app/api/_lib/handler";

type Context = { params: Promise<{ itemId: string }> };

export const PATCH = withUser<Context>(async (user, request, context) => {
  const { itemId } = await context.params;
  const input = updateChecklistItemSchema.parse(await readJson(request));
  await updateChecklistItem(user.id, itemId, input);
  return { ok: true };
});

export const DELETE = withUser<Context>(async (user, _request, context) => {
  const { itemId } = await context.params;
  await deleteChecklistItem(user.id, itemId);
  return { ok: true };
});
