import { createColumnSchema, reorderColumnsSchema } from "@/lib/validation/schemas";
import { createColumn, reorderColumns } from "@/server/services/board";
import { readJson, withUser } from "@/app/api/_lib/handler";

/** POST /api/columns — cria coluna no projeto. */
export const POST = withUser(async (user, request) => {
  const input = createColumnSchema.parse(await readJson(request));
  const column = await createColumn(user.id, input);
  return { column };
});

/** PATCH /api/columns — persiste a nova ordem das colunas. */
export const PATCH = withUser(async (user, request) => {
  const input = reorderColumnsSchema.parse(await readJson(request));
  await reorderColumns(user.id, input.projectId, input.columnIds);
  return { ok: true };
});
