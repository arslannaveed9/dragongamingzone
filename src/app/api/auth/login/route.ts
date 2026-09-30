import { clientKey, rateLimit } from "@/lib/rate-limit";
import { authed, errorResponse, json, readJson } from "@/lib/http";
import { loginSchema, zodMessage } from "@/lib/validators";
import { createSessionCookie, toActor } from "@/services/auth-service";
import { authenticate } from "@/services/bootstrap";
import { writeAudit } from "@/services/audit-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!rateLimit(clientKey(request, "login"), 10, 15 * 60 * 1000)) {
      return json({ error: { code: "RATE_LIMIT", message: "Too many sign-in attempts. Wait a few minutes." } }, 429);
    }
    const parsed = loginSchema.safeParse(await readJson(request));
    if (!parsed.success) return json({ error: { code: "VALIDATION", message: zodMessage(parsed.error) } }, 400);
    const user = await authenticate(parsed.data.email, parsed.data.password);
    const actor = toActor(user);
    await createSessionCookie(actor);
    await writeAudit({ actor, action: "auth.login", entity: "user", entityId: actor.id });
    return json({ user: actor });
  } catch (error) {
    return errorResponse(error);
  }
}

export { authed };
