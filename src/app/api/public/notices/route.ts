import { connectDB } from "@/lib/mongodb";
import { open } from "@/lib/http";
import { listNotices } from "@/services/notice-service";
import { ensureBootstrap } from "@/services/bootstrap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return open(async () => {
    await connectDB();
    await ensureBootstrap();
    return listNotices({ audience: "public", activeOnly: true });
  });
}
