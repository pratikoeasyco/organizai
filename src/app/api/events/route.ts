import { createEventSchema } from "@/lib/validation/schemas";
import { createEvent } from "@/server/services/board";
import { readJson, withUser } from "@/app/api/_lib/handler";

/** POST /api/events — cria um compromisso no calendário do projeto. */
export const POST = withUser(async (user, request) => {
  const input = createEventSchema.parse(await readJson(request));
  const event = await createEvent(user.id, input);
  return { event };
});
