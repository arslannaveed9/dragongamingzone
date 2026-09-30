import { connectDB } from "@/lib/mongodb";
import { open } from "@/lib/http";
import { ensureBootstrap } from "@/services/bootstrap";
import { getLiveBoard, toPublicBoard } from "@/services/live-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gamingDay = new URL(request.url).searchParams.get("gamingDay") || undefined;
  return open(async () => {
    await connectDB();
    await ensureBootstrap();
    return toPublicBoard(await getLiveBoard(gamingDay));
  });
}
