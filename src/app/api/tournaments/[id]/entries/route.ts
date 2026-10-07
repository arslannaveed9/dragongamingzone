import { authed, readJson } from "@/lib/http";
import { tournamentEntrySchema } from "@/lib/validators";
import { enrollPlayer } from "@/services/tournament-ledger-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const { id } = await context.params;
  return authed("tournaments.manage", async (actor) => enrollPlayer(id, tournamentEntrySchema.parse(await readJson(request)), actor));
}
