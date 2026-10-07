import { authed, readJson } from "@/lib/http";
import { tournamentBooksSchema } from "@/lib/validators";
import { saveTournamentBooks, tournamentLedger } from "@/services/tournament-ledger-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  return authed("tournaments.manage", async () => tournamentLedger(id));
}

export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params;
  return authed("tournaments.manage", async (actor) => saveTournamentBooks(id, tournamentBooksSchema.parse(await readJson(request)), actor));
}
