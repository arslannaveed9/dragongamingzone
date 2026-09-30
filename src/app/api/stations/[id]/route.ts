import { authed, readJson } from "@/lib/http";
import { stationSchema, stationStatusSchema } from "@/lib/validators";
import { setStationStatus, updateStation } from "@/services/station-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params;
  return authed("stations.manage", async (actor) => {
    const body = await readJson(request);
    if (body && typeof body === "object" && "operationalStatus" in body && Object.keys(body).length === 1) {
      const status = stationStatusSchema.parse(body);
      return setStationStatus(id, status.operationalStatus, actor);
    }
    return updateStation(id, stationSchema.parse(body), actor);
  });
}

export async function DELETE(_request: Request, context: Context) {
  const { id } = await context.params;
  return authed("stations.manage", async (actor) => setStationStatus(id, "archived", actor));
}
