import { authed, readJson } from "@/lib/http";
import { userSchema } from "@/lib/validators";
import { listUsers, saveUser } from "@/services/user-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return authed("users.manage", async () => listUsers());
}

export async function POST(request: Request) {
  return authed("users.manage", async (actor) => saveUser(null, userSchema.parse(await readJson(request)), actor));
}
