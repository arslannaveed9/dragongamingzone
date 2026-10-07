import { authed, readJson } from "@/lib/http";
import { currentSessionId, clearSessionCookie } from "@/services/auth-service";
import { listLoginSessions, revokeUserSessions } from "@/services/session-service";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  return authed("users.manage", async (actor) => listLoginSessions(id, actor, await currentSessionId()));
}

const revokeAllSchema = z.object({ action: z.literal("revoke-all") });

export async function POST(request: Request, context: Context) {
  const { id } = await context.params;
  return authed("users.manage", async (actor) => {
    revokeAllSchema.parse(await readJson(request));
    const result = await revokeUserSessions(id, actor);
    const self = actor.id === id;
    if (self) await clearSessionCookie();
    return { ...result, self };
  });
}
