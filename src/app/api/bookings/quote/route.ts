import { authed, readJson } from "@/lib/http";
import { quoteBookingSchema } from "@/lib/validators";
import { previewQuote } from "@/services/booking-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return authed("bookings.create", async () => previewQuote(quoteBookingSchema.parse(await readJson(request))));
}
