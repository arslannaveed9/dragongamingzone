import { authed, readJson } from "@/lib/http";
import { can } from "@/lib/permissions";
import { updateBookingSchema } from "@/lib/validators";
import { deleteBooking, getBooking, updateBooking } from "@/services/booking-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  return authed("bookings.view", async (actor) => ({
    ...(await getBooking(id)),
    canDelete: can(actor.role, "bookings.delete"),
  }));
}

export async function DELETE(_request: Request, context: Context) {
  const { id } = await context.params;
  return authed("bookings.delete", async (actor) => deleteBooking(id, actor));
}

export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params;
  return authed("bookings.update", async (actor) => updateBooking(id, updateBookingSchema.parse(await readJson(request)), actor));
}
