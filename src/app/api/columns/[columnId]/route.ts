import { deleteColumnSchema, updateColumnSchema } from "@/lib/validation/schemas";
import { deleteColumn, updateColumn } from "@/server/services/board";
import { readJson, withUser } from "@/app/api/_lib/handler";

type Context = { params: Promise<{ columnId: string }> };

export const PATCH = withUser<Context>(async (user, request, context) => {
  const { columnId } = await context.params;
  const input = updateColumnSchema.parse(await readJson(request));
  const column = await updateColumn(user.id, columnId, input);
  return { column };
});

export const DELETE = withUser<Context>(async (user, request, context) => {
  const { columnId } = await context.params;
  const input = deleteColumnSchema.parse(await readJson(request));
  await deleteColumn(user.id, columnId, input);
  return { ok: true };
});
