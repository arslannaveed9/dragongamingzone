import { authed, readJson } from "@/lib/http";
import { stationSchema } from "@/lib/validators";
import { getSettings } from "@/services/settings-service";
import { createStation, listStations } from "@/services/station-service";
import { listStationTypes } from "@/services/station-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const archived = new URL(request.url).searchParams.get("archived") === "1";
  return authed("stations.view", async () => {
    const [stations, types, settings] = await Promise.all([
      listStations(archived),
      listStationTypes(false),
      getSettings(),
    ]);
    return { stations, types, pricingDefaults: settings.pricingDefaults, booking: settings.booking, system: settings.system, operatingHours: settings.operatingHours };
  });
}

export async function POST(request: Request) {
  return authed("stations.manage", async (actor) => {
    const body = stationSchema.parse(await readJson(request));
    return createStation(body, actor);
  });
}
