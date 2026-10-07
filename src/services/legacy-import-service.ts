import { DateTime } from "luxon";
import { Types } from "mongoose";
import { AppError } from "@/lib/errors";
import { getGamingDay } from "@/lib/gaming-day";
import { readLegacyReport, type LegacyBooking } from "@/lib/legacy-report";
import { roundMoney } from "@/lib/money";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/booking";
import { Payment } from "@/models/payment";
import { Station } from "@/models/station";
import { StationType } from "@/models/station-type";
import { writeAudit } from "@/services/audit-service";
import type { Actor } from "@/services/auth-service";
import { getSettings } from "@/services/settings-service";

function parseWhen(value: string, zone: string) {
  const text = value.trim();
  if (!text) return null;
  const formatted = DateTime.fromFormat(text, "yyyy-MM-dd HH:mm", { zone });
  if (formatted.isValid) return formatted.toJSDate();
  const withSeconds = DateTime.fromFormat(text, "yyyy-MM-dd HH:mm:ss", { zone });
  if (withSeconds.isValid) return withSeconds.toJSDate();
  return null;
}

function chunk<T>(items: T[], size: number) {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) groups.push(items.slice(index, index + size));
  return groups;
}

export async function importLegacyReport(buffer: Buffer, actor: Actor) {
  await connectDB();
  let rows: LegacyBooking[];
  try {
    rows = readLegacyReport(buffer);
  } catch {
    throw new AppError(400, "FILE", "That file could not be read. Use the .xlsx revenue report from the old software.");
  }
  if (rows.length === 0) {
    throw new AppError(400, "FILE", "No bookings were found. Use the revenue report that includes the booking list.");
  }

  const settings = await getSettings();
  const zone = settings.operatingHours.timezone;
  const stations = await Station.find().select("name typeId").lean<{ _id: Types.ObjectId; name: string; typeId: Types.ObjectId }[]>();
  const types = await StationType.find().select("name").lean<{ _id: Types.ObjectId; name: string }[]>();
  const typeName = new Map(types.map((type) => [String(type._id), type.name]));
  const stationByName = new Map(stations.map((station) => [station.name.trim().toLowerCase(), station]));
  const missing = [...new Set(rows.map((row) => row.station).filter((name) => name && !stationByName.has(name.toLowerCase())))];
  if (missing.length) {
    throw new AppError(400, "STATION", `Add these stations before importing: ${missing.join(", ")}.`);
  }

  const existing = new Set(
    (
      await Booking.find({ bookingNumber: { $in: rows.map((row) => row.id) } })
        .select("bookingNumber")
        .lean<{ bookingNumber: string }[]>()
    ).map((row) => row.bookingNumber),
  );

  const actorId = new Types.ObjectId(actor.id);
  const bookings = [];
  const payments = [];
  let invalid = 0;
  for (const row of rows) {
    if (existing.has(row.id)) continue;
    const station = stationByName.get(row.station.toLowerCase());
    const startAt = parseWhen(row.start, zone);
    if (!station || !startAt) {
      invalid += 1;
      continue;
    }
    const statedEnd = parseWhen(row.end, zone);
    const duration = row.durationMinutes > 0 ? row.durationMinutes : statedEnd ? Math.round((statedEnd.getTime() - startAt.getTime()) / 60000) : 0;
    const endAt = statedEnd && statedEnd > startAt ? statedEnd : new Date(startAt.getTime() + Math.max(duration, 1) * 60000);
    if (endAt <= startAt) {
      invalid += 1;
      continue;
    }
    const minutes = row.durationMinutes > 0 ? row.durationMinutes : Math.max(1, Math.round((endAt.getTime() - startAt.getTime()) / 60000));
    const bookingId = new Types.ObjectId();
    const gamingDay = getGamingDay(startAt, settings.operatingHours);
    const subtotal = roundMoney(row.baseAmount + row.controllerAmount);
    bookings.push({
      _id: bookingId,
      bookingNumber: row.id,
      customerId: null,
      customerName: row.customer,
      customerNameLower: row.customer.toLowerCase(),
      customerPhone: row.phone,
      stationId: station._id,
      stationName: station.name,
      stationTypeId: station.typeId,
      stationTypeName: typeName.get(String(station.typeId)) || "",
      gamingDay,
      startAt,
      endAt,
      durationMinutes: minutes,
      controllerCount: row.controllers,
      status: "completed" as const,
      pausedAt: null,
      pausedMs: 0,
      source: row.source,
      pricing: {
        baseAmount: row.baseAmount,
        controllerAmount: row.controllerAmount,
        discountAmount: row.discount,
        subtotal,
        finalAmount: row.totalAmount,
        currency: settings.system.currency,
        appliedDiscountId: null,
        appliedDiscountName: "",
        appliedRuleId: null,
        appliedRuleName: "",
        breakdown: { imported: true },
      },
      paymentStatus: row.paymentStatus,
      amountPaid: row.collected,
      notes: row.notes,
      completedAt: endAt,
      createdBy: actorId,
      createdByName: actor.name,
      createdAt: startAt,
      updatedAt: startAt,
    });
    if (row.collected > 0) {
      payments.push({
        bookingId,
        amount: row.collected,
        kind: "payment" as const,
        method: row.method,
        reference: "",
        notes: "Imported from the previous software",
        gamingDay,
        recordedBy: actorId,
        recordedByName: actor.name,
        createdAt: startAt,
        updatedAt: startAt,
      });
    }
    if (row.refund > 0) {
      payments.push({
        bookingId,
        amount: row.refund,
        kind: "refund" as const,
        method: row.method,
        reference: "",
        notes: "Imported from the previous software",
        gamingDay,
        recordedBy: actorId,
        recordedByName: actor.name,
        createdAt: endAt,
        updatedAt: endAt,
      });
    }
  }

  for (const group of chunk(bookings, 400)) {
    await Booking.insertMany(group, { ordered: false });
  }
  for (const group of chunk(payments, 400)) {
    await Payment.insertMany(group, { ordered: false });
  }

  const days = bookings.map((booking) => booking.gamingDay).sort();
  const revenue = roundMoney(bookings.reduce((sum, booking) => sum + booking.pricing.finalAmount, 0));
  await writeAudit({
    actor,
    action: "legacy.imported",
    entity: "report",
    entityId: "legacy",
    newValue: { imported: bookings.length, skipped: rows.length - bookings.length - invalid, invalid, revenue },
  });
  return {
    imported: bookings.length,
    skipped: rows.length - bookings.length - invalid,
    invalid,
    payments: payments.length,
    from: days[0] || null,
    to: days[days.length - 1] || null,
    revenue,
  };
}
