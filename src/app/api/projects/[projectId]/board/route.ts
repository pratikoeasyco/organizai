import { getBoard } from "@/server/services/board";
import { withUser } from "@/app/api/_lib/handler";

type Context = { params: Promise<{ projectId: string }> };

/**
 * GET /api/projects/:id/board — estado completo do quadro e do calendário.
 *
 * Usado quando chega um aviso de mudança: em vez de recarregar a página
 * inteira, o cliente rebusca só este projeto e substitui o estado. Passa pelo
 * mesmo `requireProjectAccess` de sempre.
 */
export const GET = withUser<Context>(async (user, _request, context) => {
  const { projectId } = await context.params;
  const board = await getBoard(user.id, projectId);
  return { board };
});
