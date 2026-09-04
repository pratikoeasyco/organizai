import { deleteComment } from "@/server/services/tasks";
import { withUser } from "@/app/api/_lib/handler";

type Context = { params: Promise<{ commentId: string }> };

export const DELETE = withUser<Context>(async (user, _request, context) => {
  const { commentId } = await context.params;
  await deleteComment(user.id, commentId);
  return { ok: true };
});
