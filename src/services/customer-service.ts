import mongoose from "mongoose";
import { AppError } from "@/lib/errors";
import { escapeRegex, normalizePhone } from "@/lib/text";
import { Booking } from "@/models/booking";
import { Customer } from "@/models/customer";
import { writeAudit } from "@/services/audit-service";
import type { Actor } from "@/services/auth-service";

function plain(doc: {
  _id: unknown;
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
  archived?: boolean;
  stats?: {
    totalBookings?: number;
    totalMinutes?: number;
    totalSpent?: number;
    firstVisitAt?: Date | null;
    lastVisitAt?: Date | null;
  };
  createdAt?: Date;
}) {
  return {
    id: String(doc._id),
    name: doc.name,
    phone: doc.phone || "",
    email: doc.email || "",
    notes: doc.notes || "",
    archived: Boolean(doc.archived),
    stats: {
      totalBookings: doc.stats?.totalBookings ?? 0,
      totalMinutes: doc.stats?.totalMinutes ?? 0,
      totalSpent: doc.stats?.totalSpent ?? 0,
      firstVisitAt: doc.stats?.firstVisitAt ?? null,
      lastVisitAt: doc.stats?.lastVisitAt ?? null,
    },
    createdAt: doc.createdAt ?? null,
  };
}

export async function refreshCustomerStats(customerId: string) {
  const [row] = await Booking.aggregate<{
    totalBookings: number;
    totalMinutes: number;
    totalSpent: number;
    firstVisitAt: Date | null;
    lastVisitAt: Date | null;
  }>([
    { $match: { customerId: new mongoose.Types.ObjectId(customerId), status: { $ne: "cancelled" } } },
    {
      $group: {
        _id: null,
        totalBookings: { $sum: 1 },
        totalMinutes: {
          $sum: { $cond: [{ $in: ["$status", ["active", "completed"]] }, "$durationMinutes", 0] },
        },
        totalSpent: {
          $sum: { $cond: [{ $in: ["$status", ["active", "completed"]] }, "$pricing.finalAmount", 0] },
        },
        firstVisitAt: { $min: "$startAt" },
        lastVisitAt: { $max: "$startAt" },
      },
    },
  ]);
  await Customer.updateOne(
    { _id: customerId },
    {
      $set: {
        stats: row ?? {
          totalBookings: 0,
          totalMinutes: 0,
          totalSpent: 0,
          firstVisitAt: null,
          lastVisitAt: null,
        },
      },
    },
  );
}

export async function listCustomers(query: { page: number; pageSize: number; q?: string }) {
  const filter: Record<string, unknown> = { archived: false };
  if (query.q) {
    const rx = new RegExp(escapeRegex(query.q), "i");
    filter.$or = [{ name: rx }, { phone: rx }, { email: rx }];
  }
  const skip = (query.page - 1) * query.pageSize;
  const [rows, total] = await Promise.all([
    Customer.find(filter).sort({ name: 1 }).skip(skip).limit(query.pageSize).lean(),
    Customer.countDocuments(filter),
  ]);
  return { items: rows.map((row) => plain(row as never)), total, page: query.page, pageSize: query.pageSize };
}

export async function searchCustomers(q: string) {
  const rx = new RegExp(escapeRegex(q.trim()), "i");
  const phone = normalizePhone(q);
  const rows = await Customer.find({
    archived: false,
    $or: [{ name: rx }, { phone: phone ? new RegExp(escapeRegex(phone)) : rx }, { email: rx }],
  })
    .sort({ "stats.lastVisitAt": -1 })
    .limit(8)
    .lean();
  return rows.map((row) => plain(row as never));
}

export async function getCustomer(id: string) {
  const customer = await Customer.findById(id).lean();
  if (!customer || customer.archived) throw new AppError(404, "NOT_FOUND", "Customer not found.");
  const bookings = await Booking.find({ customerId: id }).sort({ startAt: -1 }).limit(50).lean();
  return {
    customer: plain(customer as never),
    bookings: bookings.map((booking) => ({
      id: String(booking._id),
      bookingNumber: booking.bookingNumber,
      stationName: booking.stationName,
      gamingDay: booking.gamingDay,
      startAt: booking.startAt,
      endAt: booking.endAt,
      durationMinutes: booking.durationMinutes,
      status: booking.status,
      finalAmount: booking.pricing.finalAmount,
    })),
  };
}

async function assertPhoneAvailable(phone: string, ignoreId?: string) {
  if (!phone) return;
  const existing = await Customer.findOne({ phone, ...(ignoreId ? { _id: { $ne: ignoreId } } : {}) });
  if (existing) throw new AppError(409, "PHONE_IN_USE", "Another customer already uses this phone number.");
}

export async function createCustomer(
  input: { name: string; phone?: string; email?: string; notes?: string },
  actor: Actor,
) {
  const phone = normalizePhone(input.phone || "");
  await assertPhoneAvailable(phone);
  const created = await Customer.create({
    name: input.name,
    phone,
    email: input.email || "",
    notes: input.notes || "",
  });
  await writeAudit({
    actor,
    action: "customer.created",
    entity: "customer",
    entityId: String(created._id),
    newValue: { name: created.name, phone },
  });
  return plain(created);
}

export async function updateCustomer(
  id: string,
  input: { name: string; phone?: string; email?: string; notes?: string },
  actor: Actor,
) {
  const existing = await Customer.findById(id);
  if (!existing || existing.archived) throw new AppError(404, "NOT_FOUND", "Customer not found.");
  const phone = normalizePhone(input.phone || "");
  await assertPhoneAvailable(phone, id);
  const previous = plain(existing);
  existing.name = input.name;
  existing.phone = phone;
  existing.email = input.email || "";
  existing.notes = input.notes || "";
  await existing.save();
  await writeAudit({
    actor,
    action: "customer.updated",
    entity: "customer",
    entityId: id,
    oldValue: previous,
    newValue: plain(existing),
  });
  return plain(existing);
}

export async function findOrCreateCustomer(input: {
  customerId?: string | null;
  name: string;
  phone?: string;
}) {
  const phone = normalizePhone(input.phone || "");
  if (input.customerId) {
    const existing = await Customer.findById(input.customerId);
    if (!existing || existing.archived) throw new AppError(404, "NOT_FOUND", "Customer not found.");
    if (phone && phone !== existing.phone) await assertPhoneAvailable(phone, String(existing._id));
    existing.name = input.name;
    if (phone) existing.phone = phone;
    await existing.save();
    return existing;
  }
  if (phone) {
    const existing = await Customer.findOne({ phone, archived: false });
    if (existing) {
      existing.name = input.name;
      await existing.save();
      return existing;
    }
  }
  return Customer.create({ name: input.name, phone, email: "", notes: "" });
}
