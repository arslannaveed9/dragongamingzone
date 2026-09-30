import { json } from "@/lib/http";
import { connectDB } from "@/lib/mongodb";
import { sweepExpiredSessions } from "@/services/sweep-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return json({ error: { code: "UNAUTHORIZED", message: "Sign in required." } }, 401);
  }
  await connectDB();
  const result = await sweepExpiredSessions();
  return json(result);
}
