import { searchTasks } from "@/server/services/search";
import { withUser } from "@/app/api/_lib/handler";

/** GET /api/search?q= — procura tarefas em todos os projetos visíveis. */
export const GET = withUser(async (user, request) => {
  const termo = new URL(request.url).searchParams.get("q") ?? "";
  const results = await searchTasks(user.id, termo);
  return { results };
});
