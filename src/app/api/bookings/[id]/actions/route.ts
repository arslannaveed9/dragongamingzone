import { authed, readJson } from "@/lib/http";
import { bookingActionSchema } from "@/lib/validators";
import { applyBookingAction } from "@/services/booking-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const { id } = await context.params;
  return authed(
    "bookings.update",
    async (actor) => applyBookingAction(id, bookingActionSchema.parse(await readJson(request)), actor),
    { sweep: true },
  );
}
