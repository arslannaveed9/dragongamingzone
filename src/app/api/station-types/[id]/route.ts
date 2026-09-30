import { authed, readJson } from "@/lib/http";
import { stationTypeSchema } from "@/lib/validators";
import { archiveStationType, updateStationType } from "@/services/station-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params;
  return authed("stations.manage", async (actor) => updateStationType(id, stationTypeSchema.parse(await readJson(request)), actor));
}

export async function DELETE(_request: Request, context: Context) {
  const { id } = await context.params;
  return authed("stations.manage", async (actor) => archiveStationType(id, actor));
}
