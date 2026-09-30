import { authed, readJson } from "@/lib/http";
import { paymentSchema } from "@/lib/validators";
import { recordBookingPayment } from "@/services/booking-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return authed("payments.record", async (actor) => recordBookingPayment(paymentSchema.parse(await readJson(request)), actor));
}
