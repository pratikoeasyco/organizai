import { z } from "zod";

import { readJson, withUser } from "@/app/api/_lib/handler";
import {
  countUnread,
  listNotifications,
  markAllRead,
  setProjectMuted,
} from "@/server/services/notifications";
import { requireProjectAccess } from "@/lib/auth/guards";

/** GET /api/notifications — caixa de entrada do usuário. */
export const GET = withUser(async (user) => {
  const [items, unread] = await Promise.all([
    listNotifications(user.id, 20),
    countUnread(user.id),
  ]);
  return { items, unread };
});

const patchSchema = z.union([
  z.object({ action: z.literal("read-all") }),
  z.object({
    action: z.literal("mute-project"),
    projectId: z.string().min(1).max(64),
    muted: z.boolean(),
  }),
]);

export const PATCH = withUser(async (user, request) => {
  const input = patchSchema.parse(await readJson(request));

  if (input.action === "read-all") {
    await markAllRead(user.id);
    return { ok: true };
  }

  // Silenciar exige acesso ao projeto — não dá para silenciar o que não se vê.
  await requireProjectAccess(user.id, input.projectId);
  await setProjectMuted(user.id, input.projectId, input.muted);
  return { ok: true, muted: input.muted };
});
