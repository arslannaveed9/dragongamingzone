import { json, open } from "@/lib/http";
import { connectDB } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return open(async () => {
    await connectDB();
    return { ok: true };
  });
}

export { json };
