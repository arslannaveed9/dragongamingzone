import { escapeRegex } from "@/lib/text";
import { Booking } from "@/models/booking";
import { Customer } from "@/models/customer";
import { Station } from "@/models/station";

export async function globalSearch(q: string) {
  const term = q.trim();
  if (term.length < 1) return { customers: [], bookings: [], stations: [] };
  const rx = new RegExp(escapeRegex(term), "i");
  const [customers, bookings, stations] = await Promise.all([
    Customer.find({ archived: false, $or: [{ name: rx }, { phone: rx }] }).limit(6).lean(),
    Booking.find({ $or: [{ bookingNumber: rx }, { customerName: rx }, { customerPhone: rx }] })
      .sort({ startAt: -1 })
      .limit(6)
      .lean(),
    Station.find({ operationalStatus: { $ne: "archived" }, name: rx }).limit(6).lean(),
  ]);
  return {
    customers: customers.map((row) => ({ id: String(row._id), name: row.name, phone: row.phone || "" })),
    bookings: bookings.map((row) => ({
      id: String(row._id),
      bookingNumber: row.bookingNumber,
      customerName: row.customerName,
      stationName: row.stationName,
      status: row.status,
      gamingDay: row.gamingDay,
    })),
    stations: stations.map((row) => ({ id: String(row._id), name: row.name, operationalStatus: row.operationalStatus })),
  };
}
