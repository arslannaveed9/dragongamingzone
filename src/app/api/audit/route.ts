import { authed, pageParams } from "@/lib/http";
import { listAudit } from "@/services/audit-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  return authed("audit.view", async () =>
    listAudit({
      ...pageParams(url, 40),
      entity: url.searchParams.get("entity") || undefined,
      action: url.searchParams.get("action") || undefined,
    }),
  );
}
