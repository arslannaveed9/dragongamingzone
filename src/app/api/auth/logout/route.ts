import { errorResponse, json } from "@/lib/http";
import { clearSessionCookie, getSessionActor } from "@/services/auth-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const actor = await getSessionActor();
    await clearSessionCookie();
    return json({ ok: true, user: actor?.id ?? null });
  } catch (error) {
    return errorResponse(error);
  }
}
