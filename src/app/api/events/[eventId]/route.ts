import { updateEventSchema } from "@/lib/validation/schemas";
import { deleteEvent, updateEvent } from "@/server/services/board";
import { readJson, withUser } from "@/app/api/_lib/handler";

type Context = { params: Promise<{ eventId: string }> };

export const PATCH = withUser<Context>(async (user, request, context) => {
  const { eventId } = await context.params;
  const input = updateEventSchema.parse(await readJson(request));
  const event = await updateEvent(user.id, eventId, input);
  return { event };
});

export const DELETE = withUser<Context>(async (user, _request, context) => {
  const { eventId } = await context.params;
  await deleteEvent(user.id, eventId);
  return { ok: true };
});
