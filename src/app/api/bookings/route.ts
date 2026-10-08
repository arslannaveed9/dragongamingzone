import { authed, pageParams, readJson } from "@/lib/http";
import { can } from "@/lib/permissions";
import { createBookingSchema } from "@/lib/validators";
import { createBooking, listBookings } from "@/services/booking-service";
import { getSettings } from "@/services/settings-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = pageParams(url);
  return authed("bookings.view", async (actor) => {
    const settings = await getSettings();
    const result = await listBookings({
      ...page,
      gamingDay: url.searchParams.get("gamingDay") || undefined,
      from: url.searchParams.get("from") || undefined,
      to: url.searchParams.get("to") || undefined,
      stationId: url.searchParams.get("stationId") || undefined,
      stationTypeId: url.searchParams.get("stationTypeId") || undefined,
      status: url.searchParams.get("status") || undefined,
      q: url.searchParams.get("q") || undefined,
    });
    return {
      ...result,
      timezone: settings.operatingHours.timezone,
      timeFormat: settings.system.timeFormat,
      currencySymbol: settings.system.currencySymbol,
      canDelete: can(actor.role, "bookings.delete"),
    };
  });
}

export async function POST(request: Request) {
  return authed("bookings.create", async (actor) => createBooking(createBookingSchema.parse(await readJson(request)), actor), { sweep: true });
}
