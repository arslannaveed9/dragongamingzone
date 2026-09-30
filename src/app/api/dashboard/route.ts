import { authed } from "@/lib/http";
import { getDashboard } from "@/services/dashboard-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return authed("dashboard.view", async () => getDashboard(), { sweep: true });
}
