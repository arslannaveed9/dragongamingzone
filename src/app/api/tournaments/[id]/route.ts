import { AppError } from "@/lib/errors";
import { authed, readJson } from "@/lib/http";
import { tournamentUpdateSchema } from "@/lib/validators";
import { getTournament, removeTournament, updateTournament } from "@/services/tournament-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  return authed("tournaments.manage", async () => {
    const tournament = await getTournament(id);
    if (!tournament) throw new AppError(404, "NOT_FOUND", "That tournament was not found.");
    return tournament;
  });
}

export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params;
  return authed("tournaments.manage", async (actor) => updateTournament(id, tournamentUpdateSchema.parse(await readJson(request)), actor));
}

export async function DELETE(_request: Request, context: Context) {
  const { id } = await context.params;
  return authed("tournaments.manage", async (actor) => removeTournament(id, actor));
}
