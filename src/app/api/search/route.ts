import { authed } from "@/lib/http";
import { globalSearch } from "@/services/search-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") || "";
  return authed("dashboard.view", async () => globalSearch(q));
}
