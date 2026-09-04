import { duplicateColumn } from "@/server/services/board";
import { withUser } from "@/app/api/_lib/handler";

type Context = { params: Promise<{ columnId: string }> };

export const POST = withUser<Context>(async (user, _request, context) => {
  const { columnId } = await context.params;
  const column = await duplicateColumn(user.id, columnId);
  return { column };
});
