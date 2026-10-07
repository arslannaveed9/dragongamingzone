import { authed, readJson } from "@/lib/http";
import { tournamentSchema } from "@/lib/validators";
import { createTournament, listTournaments } from "@/services/tournament-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return authed("tournaments.manage", async () => listTournaments());
}

export async function POST(request: Request) {
  return authed("tournaments.manage", async (actor) => createTournament(tournamentSchema.parse(await readJson(request)), actor));
}
