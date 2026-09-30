import { authed, readJson } from "@/lib/http";
import { userSchema } from "@/lib/validators";
import { saveUser } from "@/services/user-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params;
  return authed("users.manage", async (actor) => saveUser(id, userSchema.parse(await readJson(request)), actor));
}
