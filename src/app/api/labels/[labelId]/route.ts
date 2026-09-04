import { updateLabelSchema } from "@/lib/validation/schemas";
import { deleteLabel, updateLabel } from "@/server/services/tasks";
import { readJson, withUser } from "@/app/api/_lib/handler";

type Context = { params: Promise<{ labelId: string }> };

export const PATCH = withUser<Context>(async (user, request, context) => {
  const { labelId } = await context.params;
  const input = updateLabelSchema.parse(await readJson(request));
  const label = await updateLabel(user.id, labelId, input);
  return { label };
});

export const DELETE = withUser<Context>(async (user, _request, context) => {
  const { labelId } = await context.params;
  await deleteLabel(user.id, labelId);
  return { ok: true };
});
