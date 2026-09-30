import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/booking";
import { refreshCustomerStats } from "@/services/customer-service";

let sweeping: Promise<{ completed: number; noShow: number }> | null = null;

/** Completes reservations that were never started. Active sessions stay open past their end so the floor can show overtime; ending them does not bill the extra minutes. */
export async function sweepExpiredSessions(now = new Date()) {
  if (sweeping) return sweeping;
  sweeping = runSweep(now).finally(() => {
    sweeping = null;
  });
  return sweeping;
}

async function runSweep(now: Date) {
  await connectDB();
  const missed = await Booking.find({ status: "scheduled", endAt: { $lte: now } }).select("_id customerId");
  if (missed.length > 0) {
    await Booking.updateMany(
      { _id: { $in: missed.map((row) => row._id) } },
      { $set: { status: "no_show", noShowAt: now } },
    );
  }
  const customerIds = [...new Set(missed.map((row) => (row.customerId ? String(row.customerId) : "")).filter(Boolean))];
  await Promise.all(customerIds.map((id) => refreshCustomerStats(id)));
  return { completed: 0, noShow: missed.length };
}
