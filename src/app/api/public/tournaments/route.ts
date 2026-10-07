import { json, errorResponse } from "@/lib/http";
import { listPublicTournaments } from "@/services/tournament-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return json(await listPublicTournaments());
  } catch (error) {
    return errorResponse(error);
  }
}
