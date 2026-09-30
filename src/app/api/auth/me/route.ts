import { errorResponse, json } from "@/lib/http";
import { getSessionActor } from "@/services/auth-service";
import { ensureBootstrap } from "@/services/bootstrap";
import { connectDB } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectDB();
    await ensureBootstrap();
    const user = await getSessionActor();
    if (!user) return json({ user: null }, 401);
    return json({ user });
  } catch (error) {
    return errorResponse(error);
  }
}
