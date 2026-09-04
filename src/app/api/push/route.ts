import { z } from "zod";

import { readJson, withUser } from "@/app/api/_lib/handler";
import { removeSubscription, saveSubscription } from "@/server/services/notifications";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().min(1).max(255),
    auth: z.string().min(1).max(255),
  }),
});

/** POST /api/push — registra este navegador para receber notificações. */
export const POST = withUser(async (user, request) => {
  const input = subscriptionSchema.parse(await readJson(request));
  await saveSubscription(user.id, {
    endpoint: input.endpoint,
    p256dh: input.keys.p256dh,
    auth: input.keys.auth,
    userAgent: request.headers.get("user-agent"),
  });
  return { ok: true };
});

/** DELETE /api/push — o navegador deixa de receber. */
export const DELETE = withUser(async (_user, request) => {
  const input = z
    .object({ endpoint: z.string().url().max(2000) })
    .parse(await readJson(request));
  await removeSubscription(input.endpoint);
  return { ok: true };
});
