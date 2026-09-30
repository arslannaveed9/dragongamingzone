import { authed } from "@/lib/http";
import { extensionOptions } from "@/services/booking-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  return authed("bookings.view", async () => extensionOptions(id));
}
