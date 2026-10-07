import { authed } from "@/lib/http";
import { clearSessionCookie, currentSessionId } from "@/services/auth-service";
import { revokeLoginSession } from "@/services/session-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string; sessionId: string }> };

export async function DELETE(_request: Request, context: Context) {
  const { id, sessionId } = await context.params;
  return authed("users.manage", async (actor) => {
    const current = await currentSessionId();
    await revokeLoginSession(id, sessionId, actor);
    const self = current === sessionId;
    if (self) await clearSessionCookie();
    return { id: sessionId, self };
  });
}
