import { createLabelSchema } from "@/lib/validation/schemas";
import { createLabel } from "@/server/services/tasks";
import { readJson, withUser } from "@/app/api/_lib/handler";

export const POST = withUser(async (user, request) => {
  const input = createLabelSchema.parse(await readJson(request));
  const label = await createLabel(user.id, input);
  return { label };
});
