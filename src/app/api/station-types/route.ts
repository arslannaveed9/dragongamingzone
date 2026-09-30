import { authed, readJson } from "@/lib/http";
import { stationTypeSchema } from "@/lib/validators";
import { createStationType, listStationTypes } from "@/services/station-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return authed("stations.view", async () => listStationTypes(false));
}

export async function POST(request: Request) {
  return authed("stations.manage", async (actor) => createStationType(stationTypeSchema.parse(await readJson(request)), actor));
}
