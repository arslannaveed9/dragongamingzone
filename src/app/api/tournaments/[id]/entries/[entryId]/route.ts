import { authed, readJson } from "@/lib/http";
import { tournamentEntryUpdateSchema } from "@/lib/validators";
import { removePlayer, updatePlayer } from "@/services/tournament-ledger-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string; entryId: string }> };

export async function PATCH(request: Request, context: Context) {
  const { id, entryId } = await context.params;
  return authed("tournaments.manage", async (actor) => updatePlayer(id, entryId, tournamentEntryUpdateSchema.parse(await readJson(request)), actor));
}

export async function DELETE(_request: Request, context: Context) {
  const { id, entryId } = await context.params;
  return authed("tournaments.manage", async (actor) => removePlayer(id, entryId, actor));
}
