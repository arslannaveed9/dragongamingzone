import { AppError } from "@/lib/errors";
import { findConflictingInterval } from "@/lib/conflicts";
import { assertDuration, assertStep } from "@/lib/duration";
import {
  combineGamingDayAndTime,
  formatClock,
  getGamingDay,
  isRangeWithinGamingDay,
  shiftGamingDay,
  type OperatingHours,
} from "@/lib/gaming-day";
import { can } from "@/lib/permissions";
import { escapeRegex } from "@/lib/text";
import { Booking } from "@/models/booking";
import { Counter } from "@/models/counter";
import { Payment } from "@/models/payment";
import { Bill, PosOrder } from "@/models/pos";
import { AuditLog } from "@/models/audit-log";
import { Station } from "@/models/station";
import { writeAudit } from "@/services/audit-service";
import type { Actor } from "@/services/auth-service";
import { findOrCreateCustomer, refreshCustomerStats } from "@/services/customer-service";
import { priceSnapshot, quoteBooking } from "@/services/quote-service";
import { getSettings, type AppSettings } from "@/services/settings-service";
import { withStationLocks } from "@/services/station-lock";

const BLOCKING = ["scheduled", "active"];

type BookingInput = {
  mode: "walk_in" | "reservation";
  customerName: string;
  customerPhone?: string;
  customerId?: string | null;
  stationId: string;
  controllerCount: number;
  gamingDay?: string;
  startTime?: string;
  durationMinutes: number;
  notes?: string;
  payment?: { amount: number; method: string; reference?: string } | null;
};

function clock(date: Date, settings: AppSettings) {
  return formatClock(date, settings.operatingHours.timezone, settings.system.timeFormat);
}

function conflictError(stationName: string, start: Date, end: Date, settings: AppSettings) {
  return new AppError(
    409,
    "BOOKING_CONFLICT",
    `${stationName} is already booked from ${clock(start, settings)} to ${clock(end, settings)}.`,
  );
}

export function derivePaymentStatus(amountPaid: number, finalAmount: number, hasRefund: boolean) {
  if (hasRefund && amountPaid <= 0.009) return "refunded" as const;
  if (amountPaid <= 0.009) return "unpaid" as const;
  if (amountPaid + 0.009 < finalAmount) return "partial" as const;
  return "paid" as const;
}

export function remainingMs(booking: { endAt: Date | string; pausedAt?: Date | string | null }, now = new Date()) {
  const end = new Date(booking.endAt).getTime();
  if (booking.pausedAt) return Math.max(0, end - new Date(booking.pausedAt).getTime());
  return end - now.getTime();
}

export function serializeBooking(booking: {
  _id: unknown;
  bookingNumber: string;
  customerId?: unknown;
  customerName: string;
  customerPhone?: string;
  stationId: unknown;
  stationName: string;
  stationTypeId: unknown;
  stationTypeName: string;
  gamingDay: string;
  startAt: Date;
  endAt: Date;
  durationMinutes: number;
  controllerCount: number;
  status: string;
  pausedAt?: Date | null;
  source: string;
  pricing: unknown;
  paymentStatus: string;
  amountPaid: number;
  notes?: string;
  cancelReason?: string;
  cancelledAt?: Date | null;
  completedAt?: Date | null;
  autoCompleted?: boolean;
  createdByName: string;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: String(booking._id),
    bookingNumber: booking.bookingNumber,
    customerId: booking.customerId ? String(booking.customerId) : null,
    customerName: booking.customerName,
    customerPhone: booking.customerPhone || "",
    stationId: String(booking.stationId),
    stationName: booking.stationName,
    stationTypeId: String(booking.stationTypeId),
    stationTypeName: booking.stationTypeName,
    gamingDay: booking.gamingDay,
    startAt: new Date(booking.startAt).toISOString(),
    endAt: new Date(booking.endAt).toISOString(),
    durationMinutes: booking.durationMinutes,
    controllerCount: booking.controllerCount,
    status: booking.status,
    pausedAt: booking.pausedAt ? new Date(booking.pausedAt).toISOString() : null,
    paused: Boolean(booking.pausedAt),
    remainingMs: remainingMs(booking),
    source: booking.source,
    pricing: booking.pricing,
    paymentStatus: booking.paymentStatus,
    amountPaid: booking.amountPaid ?? 0,
    notes: booking.notes || "",
    cancelReason: booking.cancelReason || "",
    cancelledAt: booking.cancelledAt ? new Date(booking.cancelledAt).toISOString() : null,
    completedAt: booking.completedAt ? new Date(booking.completedAt).toISOString() : null,
    autoCompleted: Boolean(booking.autoCompleted),
    createdByName: booking.createdByName,
    createdAt: booking.createdAt ? new Date(booking.createdAt).toISOString() : null,
    updatedAt: booking.updatedAt ? new Date(booking.updatedAt).toISOString() : null,
  };
}

function auditFields(booking: {
  customerName: string;
  customerPhone?: string;
  stationName: string;
  stationTypeName: string;
  gamingDay: string;
  startAt: Date;
  endAt: Date;
  durationMinutes: number;
  controllerCount: number;
  status: string;
  paymentStatus: string;
  amountPaid?: number;
  pricing?: { finalAmount?: number };
  notes?: string;
  cancelReason?: string;
  pausedAt?: Date | null;
}) {
  return {
    customerName: booking.customerName,
    customerPhone: booking.customerPhone || "",
    stationName: booking.stationName,
    stationTypeName: booking.stationTypeName,
    gamingDay: booking.gamingDay,
    startAt: new Date(booking.startAt).toISOString(),
    endAt: new Date(booking.endAt).toISOString(),
    durationMinutes: booking.durationMinutes,
    controllerCount: booking.controllerCount,
    status: booking.status,
    paused: Boolean(booking.pausedAt),
    paymentStatus: booking.paymentStatus,
    amountPaid: booking.amountPaid ?? 0,
    finalAmount: booking.pricing?.finalAmount ?? 0,
    notes: booking.notes || "",
    cancelReason: booking.cancelReason || "",
  };
}

async function nextBookingNumber(gamingDay: string) {
  const counter = await Counter.findByIdAndUpdate("booking", { $inc: { seq: 1 } }, { upsert: true, new: true });
  const seq = String(counter.seq).padStart(4, "0");
  return `GZ-${gamingDay.replace(/-/g, "").slice(2)}-${seq}`;
}

function resolveTimes(
  input: { mode: "walk_in" | "reservation"; gamingDay?: string; startTime?: string; durationMinutes: number },
  settings: AppSettings,
  now: Date,
) {
  const hours = settings.operatingHours;
  let startAt: Date;
  if (input.mode === "walk_in" && !input.startTime) {
    startAt = new Date(now);
  } else {
    if (!input.gamingDay || !input.startTime) {
      throw new AppError(400, "VALIDATION", "Choose a date and start time.");
    }
    startAt = combineGamingDayAndTime(input.gamingDay, input.startTime, hours);
  }
  assertDuration(input.durationMinutes, settings.booking);
  const endAt = new Date(startAt.getTime() + input.durationMinutes * 60_000);
  const range = isRangeWithinGamingDay(startAt, endAt, hours);
  if (!range.ok) throw new AppError(400, "OUTSIDE_HOURS", range.reason);
  if (input.gamingDay && input.startTime && input.gamingDay !== range.gamingDay) {
    throw new AppError(400, "GAMING_DAY", "That start time belongs to a different gaming day.");
  }
  const backdated = startAt.getTime() < now.getTime() - 2 * 60_000;
  return { startAt, endAt, gamingDay: range.gamingDay, backdated };
}

function assertAdvance(gamingDay: string, backdated: boolean, settings: AppSettings, now: Date) {
  if (backdated) return;
  const current = getGamingDay(now, settings.operatingHours);
  const maxDay = shiftGamingDay(current, settings.booking.maxAdvanceDays);
  if (gamingDay > maxDay) {
    throw new AppError(400, "TOO_FAR", `Bookings can only be made ${settings.booking.maxAdvanceDays} gaming days ahead.`);
  }
}

function stationAvailabilityMessage(status: string) {
  if (status === "maintenance") return "Station is currently under maintenance.";
  return "Station is currently disabled.";
}

async function loadStation(stationId: string) {
  const station = await Station.findById(stationId).populate("typeId");
  if (!station || station.operationalStatus === "archived") {
    throw new AppError(404, "NOT_FOUND", "Station not found.");
  }
  return station;
}

function typeOf(station: { typeId: { _id?: unknown; name?: string } | unknown }) {
  const type = station.typeId as { _id?: unknown; name?: string };
  return { id: String(type?._id ?? station.typeId), name: type?.name || "Station" };
}

async function overlapping(stationId: string, startAt: Date, endAt: Date, excludeId?: string) {
  const rows = await Booking.find({
    stationId,
    status: { $in: BLOCKING },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  })
    .sort({ startAt: 1 })
    .lean();
  const now = Date.now();
  const occupying = rows
    .map((row) => {
      const endAt = row.status === "active" && new Date(row.endAt).getTime() <= now
        ? new Date(now + 60_000)
        : row.endAt;
      return { ...row, endAt };
    })
    .filter((row) => new Date(row.startAt) < endAt && new Date(row.endAt) > startAt);
  return findConflictingInterval(startAt, endAt, occupying);
}

async function hasRefund(bookingId: string) {
  const count = await Payment.countDocuments({ bookingId, kind: "refund" });
  return count > 0;
}

async function reprice(booking: {
  stationId: unknown;
  stationTypeId?: unknown;
  startAt: Date;
  durationMinutes: number;
  controllerCount: number;
  gamingDay: string;
  amountPaid: number;
  pricing: { currency?: string };
  _id: unknown;
}, station: { _id: unknown; typeId: unknown; pricing: unknown }, settings: AppSettings) {
  const type = typeOf(station);
  const quote = await quoteBooking({
    stationId: String(station._id),
    stationTypeId: type.id,
    pricing: station.pricing as never,
    startAt: booking.startAt,
    durationMinutes: booking.durationMinutes,
    controllerCount: booking.controllerCount,
    gamingDay: booking.gamingDay,
    settings,
  });
  const refunded = await hasRefund(String(booking._id));
  booking.pricing = priceSnapshot(quote, settings.system.currency) as never;
  return { quote, paymentStatus: derivePaymentStatus(booking.amountPaid, quote.finalAmount, refunded) };
}

export async function previewQuote(input: {
  mode: "walk_in" | "reservation";
  stationId: string;
  controllerCount: number;
  gamingDay?: string;
  startTime?: string;
  durationMinutes: number;
}) {
  const settings = await getSettings();
  const station = await loadStation(input.stationId);
  if (input.controllerCount > station.maxControllers) {
    throw new AppError(400, "CONTROLLERS", `This station allows up to ${station.maxControllers} controllers.`);
  }
  const times = resolveTimes(input, settings, new Date());
  const type = typeOf(station);
  const quote = await quoteBooking({
    stationId: String(station._id),
    stationTypeId: type.id,
    pricing: station.pricing,
    startAt: times.startAt,
    durationMinutes: input.durationMinutes,
    controllerCount: input.controllerCount,
    gamingDay: times.gamingDay,
    settings,
  });
  return {
    ...quote,
    currency: settings.system.currency,
    currencySymbol: settings.system.currencySymbol,
    gamingDay: times.gamingDay,
    startAt: times.startAt.toISOString(),
    endAt: times.endAt.toISOString(),
    backdated: times.backdated,
  };
}

export async function createBooking(input: BookingInput, actor: Actor) {
  const settings = await getSettings();
  const now = new Date();
  const station = await loadStation(input.stationId);
  const times = resolveTimes(input, settings, now);
  if (times.backdated && !can(actor.role, "bookings.backdate")) {
    throw new AppError(403, "FORBIDDEN", "You do not have permission to create backdated bookings.");
  }
  assertAdvance(times.gamingDay, times.backdated, settings, now);
  if (station.operationalStatus !== "active" && !times.backdated) {
    throw new AppError(400, "STATION_UNAVAILABLE", stationAvailabilityMessage(station.operationalStatus));
  }
  if (input.controllerCount > station.maxControllers) {
    throw new AppError(400, "CONTROLLERS", `This station allows up to ${station.maxControllers} controllers.`);
  }

  return withStationLocks([String(station._id)], async () => {
    const fresh = await loadStation(String(station._id));
    if (fresh.operationalStatus !== "active" && !times.backdated) {
      throw new AppError(400, "STATION_UNAVAILABLE", stationAvailabilityMessage(fresh.operationalStatus));
    }
    const conflict = await overlapping(String(fresh._id), times.startAt, times.endAt);
    if (conflict) throw conflictError(fresh.name, conflict.startAt, conflict.endAt, settings);

    const type = typeOf(fresh);
    const quote = await quoteBooking({
      stationId: String(fresh._id),
      stationTypeId: type.id,
      pricing: fresh.pricing,
      startAt: times.startAt,
      durationMinutes: input.durationMinutes,
      controllerCount: input.controllerCount,
      gamingDay: times.gamingDay,
      settings,
    });
    const customer = await findOrCreateCustomer({
      customerId: input.customerId,
      name: input.customerName,
      phone: input.customerPhone,
    });
    const status = times.endAt.getTime() <= now.getTime()
      ? "completed"
      : input.mode === "reservation"
        ? "scheduled"
        : times.startAt.getTime() <= now.getTime()
          ? "active"
          : "scheduled";
    const paid = input.payment?.amount ?? 0;
    const booking = await Booking.create({
      bookingNumber: await nextBookingNumber(times.gamingDay),
      customerId: customer._id,
      customerName: customer.name,
      customerNameLower: customer.name.toLowerCase(),
      customerPhone: customer.phone || "",
      stationId: fresh._id,
      stationName: fresh.name,
      stationTypeId: type.id,
      stationTypeName: type.name,
      gamingDay: times.gamingDay,
      startAt: times.startAt,
      endAt: times.endAt,
      durationMinutes: input.durationMinutes,
      controllerCount: input.controllerCount,
      status,
      source: times.backdated ? "backdated" : status === "scheduled" ? "reservation" : "walk_in",
      pricing: priceSnapshot(quote, settings.system.currency),
      paymentStatus: derivePaymentStatus(paid, quote.finalAmount, false),
      amountPaid: paid,
      notes: input.notes || "",
      completedAt: status === "completed" ? now : null,
      createdBy: actor.id,
      createdByName: actor.name,
      updatedBy: actor.id,
      updatedByName: actor.name,
    });
    if (paid > 0 && input.payment) {
      await Payment.create({
        bookingId: booking._id,
        customerId: customer._id,
        amount: paid,
        kind: "payment",
        method: input.payment.method,
        reference: input.payment.reference || "",
        gamingDay: times.gamingDay,
        recordedBy: actor.id,
        recordedByName: actor.name,
      });
      await writeAudit({
        actor,
        action: "payment.recorded",
        entity: "booking",
        entityId: String(booking._id),
        newValue: { amount: paid, method: input.payment.method },
      });
    }
    await refreshCustomerStats(String(customer._id));
    await writeAudit({
      actor,
      action: status === "active" ? "session.started" : "booking.created",
      entity: "booking",
      entityId: String(booking._id),
      newValue: serializeBooking(booking),
    });
    return serializeBooking(booking);
  });
}

export async function listBookings(query: {
  page: number;
  pageSize: number;
  gamingDay?: string;
  from?: string;
  to?: string;
  stationId?: string;
  stationTypeId?: string;
  status?: string;
  q?: string;
}) {
  const filter: Record<string, unknown> = {};
  if (query.gamingDay) filter.gamingDay = query.gamingDay;
  else if (query.from || query.to) {
    filter.gamingDay = {
      ...(query.from ? { $gte: query.from } : {}),
      ...(query.to ? { $lte: query.to } : {}),
    };
  }
  if (query.stationId) filter.stationId = query.stationId;
  if (query.stationTypeId) filter.stationTypeId = query.stationTypeId;
  if (query.status) filter.status = query.status;
  if (query.q) {
    const rx = new RegExp(escapeRegex(query.q.trim()), "i");
    filter.$or = [{ bookingNumber: rx }, { customerName: rx }, { customerPhone: rx }];
  }
  const skip = (query.page - 1) * query.pageSize;
  const [rows, total] = await Promise.all([
    Booking.find(filter).sort({ startAt: -1 }).skip(skip).limit(query.pageSize).lean(),
    Booking.countDocuments(filter),
  ]);
  return {
    items: rows.map((row) => serializeBooking(row as never)),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function getBooking(id: string) {
  const booking = await Booking.findById(id).lean();
  if (!booking) throw new AppError(404, "NOT_FOUND", "Booking not found.");
  const [payments, orders, historyRows] = await Promise.all([
    Payment.find({ bookingId: id }).sort({ createdAt: -1 }).lean(),
    PosOrder.find({ bookingId: id }).sort({ createdAt: -1 }).lean(),
    AuditLog.find({ entity: "booking", entityId: id }).sort({ createdAt: -1 }).limit(50).lean(),
  ]);
  const history = {
    items: historyRows.map((item) => ({
      id: String(item._id),
      userName: item.userName,
      action: item.action,
      oldValue: item.oldValue ?? null,
      newValue: item.newValue ?? null,
      createdAt: item.createdAt,
    })),
  };
  const settings = await getSettings();
  const productTotal = orders.reduce((sum, order) => sum + order.total, 0);
  return {
    booking: serializeBooking(booking as never),
    timezone: settings.operatingHours.timezone,
    timeFormat: settings.system.timeFormat,
    currencySymbol: settings.system.currencySymbol,
    payments: payments.map((payment) => ({
      id: String(payment._id),
      amount: payment.amount,
      kind: payment.kind,
      method: payment.method,
      reference: payment.reference || "",
      notes: payment.notes || "",
      recordedByName: payment.recordedByName,
      createdAt: payment.createdAt,
    })),
    productOrders: orders.map((order) => ({
      id: String(order._id),
      orderNumber: order.orderNumber,
      items: order.items,
      total: order.total,
      paymentMethod: order.paymentMethod,
      createdAt: order.createdAt,
    })),
    combinedTotal: Math.round((booking.pricing.finalAmount + productTotal) * 100) / 100,
    history: history.items,
  };
}

export async function deleteBooking(id: string, actor: Actor) {
  const booking = await mustBooking(id);
  const customerId = booking.customerId ? String(booking.customerId) : null;
  const [payments, orders] = await Promise.all([
    Payment.deleteMany({ bookingId: booking._id }),
    PosOrder.deleteMany({ bookingId: booking._id }),
  ]);
  await Bill.updateMany({ bookingIds: booking._id }, { $pull: { bookingIds: booking._id } });
  await AuditLog.deleteMany({ entity: "booking", entityId: id });
  await booking.deleteOne();
  if (customerId) await refreshCustomerStats(customerId);
  await writeAudit({
    actor,
    action: "booking.deleted",
    entity: "booking",
    entityId: id,
    oldValue: {
      bookingNumber: booking.bookingNumber,
      customerName: booking.customerName,
      stationName: booking.stationName,
      gamingDay: booking.gamingDay,
      status: booking.status,
      finalAmount: booking.pricing.finalAmount,
      amountPaid: booking.amountPaid,
      payments: payments.deletedCount,
      orders: orders.deletedCount,
    },
  });
  return { deleted: true };
}

async function mustBooking(id: string) {
  const booking = await Booking.findById(id);
  if (!booking) throw new AppError(404, "NOT_FOUND", "Booking not found.");
  return booking;
}

function assertOpen(status: string) {
  if (status === "cancelled" || status === "no_show" || status === "completed") {
    throw new AppError(400, "INVALID_STATE", "This booking can no longer be changed.");
  }
}

export async function applyBookingAction(
  id: string,
  action:
    | { type: "start"; force?: boolean }
    | { type: "end" }
    | { type: "cancel"; reason?: string }
    | { type: "no_show" }
    | { type: "extend"; minutes: number }
    | { type: "reduce"; minutes: number }
    | { type: "pause" }
    | { type: "resume"; preserveTime?: boolean },
  actor: Actor,
) {
  const settings = await getSettings();
  const existing = await mustBooking(id);
  return withStationLocks([String(existing.stationId)], async () => {
    const booking = await mustBooking(id);
    const before = auditFields(booking);
    const now = new Date();
    if (action.type === "cancel") {
      if (booking.status === "cancelled") throw new AppError(400, "INVALID_STATE", "This booking is already cancelled.");
      if (booking.status === "completed") throw new AppError(400, "INVALID_STATE", "Completed bookings stay in the record. Adjust payment if needed.");
      if (settings.booking.cancellationRequiresReason && !action.reason?.trim()) {
        throw new AppError(400, "REASON", "Enter a cancellation reason.");
      }
      booking.status = "cancelled";
      booking.cancelReason = action.reason?.trim() || "";
      booking.cancelledAt = now;
      booking.cancelledBy = actor.id;
      booking.pausedAt = null;
      booking.updatedBy = actor.id;
      booking.updatedByName = actor.name;
      await booking.save();
      if (booking.customerId) await refreshCustomerStats(String(booking.customerId));
      await writeAudit({
        actor,
        action: "booking.cancelled",
        entity: "booking",
        entityId: id,
        oldValue: before,
        newValue: auditFields(booking),
      });
      return serializeBooking(booking);
    }

    if (action.type === "no_show") {
      if (booking.status !== "scheduled") throw new AppError(400, "INVALID_STATE", "Only a scheduled reservation can be marked as a no-show.");
      if (now < booking.startAt) throw new AppError(400, "TOO_EARLY", "A reservation can be marked no-show only after its start time.");
      booking.status = "no_show";
      booking.noShowAt = now;
      booking.updatedBy = actor.id;
      booking.updatedByName = actor.name;
      await booking.save();
      if (booking.customerId) await refreshCustomerStats(String(booking.customerId));
      await writeAudit({ actor, action: "booking.no_show", entity: "booking", entityId: id, oldValue: before, newValue: auditFields(booking) });
      return serializeBooking(booking);
    }

    if (action.type === "start") {
      if (booking.status !== "scheduled") throw new AppError(400, "INVALID_STATE", "Only a scheduled reservation can be started.");
      if (now >= booking.endAt) throw new AppError(400, "EXPIRED", "This reservation has already ended.");
      const early = now.getTime() < booking.startAt.getTime();
      const earliest = booking.startAt.getTime() - settings.booking.earlyStartMinutes * 60_000;
      if (early && !action.force && now.getTime() < earliest) {
        throw new AppError(400, "TOO_EARLY", "Use start early to begin before the reserved time.");
      }
      if (early) {
        const newEnd = new Date(now.getTime() + booking.durationMinutes * 60_000);
        const conflict = await overlapping(String(booking.stationId), now, newEnd, id);
        if (conflict) throw conflictError(booking.stationName, conflict.startAt, conflict.endAt, settings);
        booking.startAt = now;
        booking.endAt = newEnd;
        booking.gamingDay = getGamingDay(now, settings.operatingHours);
      }
      booking.status = "active";
      if (early) {
        await saveRepriced(booking, settings, actor, "session.started", before);
      } else {
        booking.updatedBy = actor.id;
        booking.updatedByName = actor.name;
        await booking.save();
        await writeAudit({ actor, action: "session.started", entity: "booking", entityId: id, oldValue: before, newValue: auditFields(booking) });
      }
      return serializeBooking(booking);
    }

    if (action.type === "pause") {
      if (!settings.booking.allowPause) throw new AppError(400, "PAUSE_DISABLED", "Pausing sessions is turned off in settings.");
      if (booking.status !== "active") throw new AppError(400, "INVALID_STATE", "Only an active session can be paused.");
      if (booking.pausedAt) throw new AppError(400, "INVALID_STATE", "This session is already paused.");
      booking.pausedAt = now;
      booking.updatedBy = actor.id;
      booking.updatedByName = actor.name;
      await booking.save();
      await writeAudit({ actor, action: "session.paused", entity: "booking", entityId: id, oldValue: before, newValue: auditFields(booking) });
      return serializeBooking(booking);
    }

    if (action.type === "resume") {
      if (booking.status !== "active" || !booking.pausedAt) {
        throw new AppError(400, "INVALID_STATE", "This session is not paused.");
      }
      if (now >= booking.endAt) {
        throw new AppError(400, "EXPIRED", "This session reached its end time while paused.");
      }
      if (action.preserveTime !== false) {
        const pauseMs = now.getTime() - new Date(booking.pausedAt).getTime();
        const newEnd = new Date(booking.endAt.getTime() + pauseMs);
        const conflict = await overlapping(String(booking.stationId), booking.startAt, newEnd, id);
        if (conflict) {
          throw new AppError(
            409,
            "EXTEND_CONFLICT",
            `Cannot extend this session because another booking begins at ${clock(conflict.startAt, settings)}.`,
          );
        }
        booking.pausedMs = (booking.pausedMs || 0) + pauseMs;
        booking.endAt = newEnd;
      }
      booking.pausedAt = null;
      booking.updatedBy = actor.id;
      booking.updatedByName = actor.name;
      await booking.save();
      await writeAudit({ actor, action: "session.resumed", entity: "booking", entityId: id, oldValue: before, newValue: auditFields(booking) });
      return serializeBooking(booking);
    }

    if (action.type === "extend") {
      assertOpen(booking.status);
      assertStep(action.minutes, settings.booking.durationStepMinutes);
      const newDuration = booking.durationMinutes + action.minutes;
      assertDuration(newDuration, settings.booking);
      const newEnd = new Date(booking.endAt.getTime() + action.minutes * 60_000);
      const conflict = await overlapping(String(booking.stationId), booking.startAt, newEnd, id);
      if (conflict) {
        throw new AppError(
          409,
          "EXTEND_CONFLICT",
          `Cannot extend this session because another booking begins at ${clock(conflict.startAt, settings)}.`,
        );
      }
      booking.durationMinutes = newDuration;
      booking.endAt = newEnd;
      await saveRepriced(booking, settings, actor, "booking.extended", before);
      return serializeBooking(booking);
    }

    if (action.type === "reduce") {
      if (!can(actor.role, "bookings.reduce_time")) {
        throw new AppError(403, "FORBIDDEN", "You do not have permission to reduce session time.");
      }
      assertOpen(booking.status);
      assertStep(action.minutes, settings.booking.durationStepMinutes);
      const newDuration = booking.durationMinutes - action.minutes;
      assertDuration(newDuration, settings.booking);
      const newEnd = new Date(booking.endAt.getTime() - action.minutes * 60_000);
      if (booking.status === "active" && newEnd.getTime() <= now.getTime()) {
        throw new AppError(400, "DURATION", "End the session instead of reducing it past the current time.");
      }
      if (newEnd.getTime() <= booking.startAt.getTime()) {
        throw new AppError(400, "DURATION", "End time must be after start time.");
      }
      booking.durationMinutes = newDuration;
      booking.endAt = newEnd;
      await saveRepriced(booking, settings, actor, "booking.reduced", before);
      return serializeBooking(booking);
    }

    if (booking.status === "scheduled") {
      booking.status = "completed";
      booking.completedAt = now;
      booking.autoCompleted = false;
      booking.pausedAt = null;
      booking.updatedBy = actor.id;
      booking.updatedByName = actor.name;
      await booking.save();
      if (booking.customerId) await refreshCustomerStats(String(booking.customerId));
      await writeAudit({ actor, action: "session.ended", entity: "booking", entityId: id, oldValue: before, newValue: auditFields(booking) });
      return serializeBooking(booking);
    }
    if (booking.status !== "active") throw new AppError(400, "INVALID_STATE", "Only an open booking can be ended.");
    const playedMs = (booking.pausedAt ? new Date(booking.pausedAt).getTime() : now.getTime()) - booking.startAt.getTime() - (booking.pausedMs || 0);
    const step = settings.booking.durationStepMinutes;
    let billed = Math.ceil(Math.max(playedMs, 0) / 60000 / step) * step;
    if (billed < settings.booking.minDurationMinutes) billed = settings.booking.minDurationMinutes;
    if (billed > booking.durationMinutes) billed = booking.durationMinutes;
    booking.durationMinutes = billed;
    booking.endAt = now;
    booking.status = "completed";
    booking.completedAt = now;
    booking.pausedAt = null;
    booking.autoCompleted = false;
    await saveRepriced(booking, settings, actor, "session.ended", before);
    if (booking.customerId) await refreshCustomerStats(String(booking.customerId));
    return serializeBooking(booking);
  });
}

async function saveRepriced(
  booking: {
    _id: unknown;
    stationId: unknown;
    startAt: Date;
    durationMinutes: number;
    controllerCount: number;
    gamingDay: string;
    amountPaid: number;
    pricing: { currency?: string; finalAmount?: number };
    paymentStatus: string;
    status: string;
    customerName: string;
    customerPhone?: string;
    stationName: string;
    stationTypeName: string;
    endAt: Date;
    notes?: string;
    cancelReason?: string;
    pausedAt?: Date | null;
    updatedBy?: unknown;
    updatedByName?: string;
    save: () => Promise<unknown>;
  },
  settings: AppSettings,
  actor: Actor,
  action: string,
  previous?: ReturnType<typeof auditFields>,
) {
  const station = await loadStation(String(booking.stationId));
  const { paymentStatus } = await reprice(booking, station, settings);
  booking.paymentStatus = paymentStatus;
  booking.updatedBy = actor.id;
  booking.updatedByName = actor.name;
  await booking.save();
  await writeAudit({
    actor,
    action,
    entity: "booking",
    entityId: String(booking._id),
    oldValue: previous ?? null,
    newValue: auditFields(booking),
  });
}

export async function updateBooking(
  id: string,
  input: {
    customerName?: string;
    customerPhone?: string;
    notes?: string;
    controllerCount?: number;
    stationId?: string;
    gamingDay?: string;
    startTime?: string;
    durationMinutes?: number;
  },
  actor: Actor,
) {
  const settings = await getSettings();
  const current = await mustBooking(id);
  const scheduleChange = Boolean(input.stationId || input.controllerCount || input.durationMinutes || input.startTime || input.gamingDay);
  if ((current.status === "cancelled" || current.status === "no_show") && scheduleChange) {
    throw new AppError(400, "INVALID_STATE", "This booking can no longer be changed.");
  }
  if (current.status === "completed" && scheduleChange && !can(actor.role, "bookings.correct")) {
    throw new AppError(403, "FORBIDDEN", "You do not have permission to correct a completed booking.");
  }
  const targetStationId = input.stationId || String(current.stationId);
  return withStationLocks([String(current.stationId), targetStationId], async () => {
    const booking = await mustBooking(id);
    const before = auditFields(booking);
    if (input.notes !== undefined) booking.notes = input.notes;
    if (input.customerName) {
      booking.customerName = input.customerName;
      booking.customerNameLower = input.customerName.toLowerCase();
    }
    if (input.customerPhone !== undefined) booking.customerPhone = input.customerPhone;
    if (booking.customerId && (input.customerName || input.customerPhone !== undefined)) {
      await findOrCreateCustomer({
        customerId: String(booking.customerId),
        name: booking.customerName,
        phone: booking.customerPhone,
      });
    }

    if (scheduleChange && booking.status !== "cancelled" && booking.status !== "no_show") {
      const station = await loadStation(targetStationId);
      const hours: OperatingHours = settings.operatingHours;
      const gamingDay = input.gamingDay || booking.gamingDay;
      const startAt = input.startTime
        ? combineGamingDayAndTime(gamingDay, input.startTime, hours)
        : input.gamingDay
          ? combineGamingDayAndTime(gamingDay, formatClock(booking.startAt, hours.timezone, "24h"), hours)
          : booking.startAt;
      const duration = input.durationMinutes ?? booking.durationMinutes;
      assertDuration(duration, settings.booking);
      const endAt = new Date(startAt.getTime() + duration * 60_000);
      const range = isRangeWithinGamingDay(startAt, endAt, hours);
      if (!range.ok) throw new AppError(400, "OUTSIDE_HOURS", range.reason);
      const backdated = startAt.getTime() < Date.now() - 2 * 60_000;
      if (backdated && !can(actor.role, "bookings.backdate") && !can(actor.role, "bookings.correct")) {
        throw new AppError(403, "FORBIDDEN", "You do not have permission to create backdated bookings.");
      }
      if (station.operationalStatus !== "active" && booking.status !== "completed") {
        throw new AppError(400, "STATION_UNAVAILABLE", stationAvailabilityMessage(station.operationalStatus));
      }
      const controllers = input.controllerCount ?? booking.controllerCount;
      if (controllers > station.maxControllers) {
        throw new AppError(400, "CONTROLLERS", `This station allows up to ${station.maxControllers} controllers.`);
      }
      if ((booking.status === "active" || booking.status === "scheduled") && duration < booking.durationMinutes && !can(actor.role, "bookings.reduce_time")) {
        throw new AppError(403, "FORBIDDEN", "You do not have permission to reduce session time.");
      }
      const conflict = await overlapping(String(station._id), startAt, endAt, id);
      if (conflict) throw conflictError(station.name, conflict.startAt, conflict.endAt, settings);
      const type = typeOf(station);
      booking.stationId = station._id;
      booking.stationName = station.name;
      booking.stationTypeId = type.id;
      booking.stationTypeName = type.name;
      booking.controllerCount = controllers;
      booking.gamingDay = range.gamingDay;
      booking.startAt = startAt;
      booking.endAt = endAt;
      booking.durationMinutes = duration;
      await saveRepriced(booking, settings, actor, "booking.edited", before);
      if (booking.customerId) await refreshCustomerStats(String(booking.customerId));
      return serializeBooking(booking);
    }

    booking.updatedBy = actor.id;
    booking.updatedByName = actor.name;
    await booking.save();
    await writeAudit({ actor, action: "booking.edited", entity: "booking", entityId: id, oldValue: before, newValue: auditFields(booking) });
    return serializeBooking(booking);
  });
}

export async function recordBookingPayment(
  input: { bookingId: string; amount: number; method: string; kind?: "payment" | "refund"; reference?: string; notes?: string },
  actor: Actor,
) {
  if (input.kind === "refund" && !can(actor.role, "payments.refund")) {
    throw new AppError(403, "FORBIDDEN", "You do not have permission to refund a payment.");
  }
  const booking = await mustBooking(input.bookingId);
  const before = auditFields(booking);
  const settings = await getSettings();
  const nextPaid = input.kind === "refund" ? booking.amountPaid - input.amount : booking.amountPaid + input.amount;
  if (nextPaid < -0.001) throw new AppError(400, "REFUND", "Refund cannot exceed the amount collected.");
  if (input.kind !== "refund" && nextPaid - booking.pricing.finalAmount > 0.001 && input.amount > booking.pricing.finalAmount) {
    // Overpayment is allowed when settling a bill, but a single payment far above the balance is rejected.
  }
  const payment = await Payment.create({
    bookingId: booking._id,
    customerId: booking.customerId,
    amount: input.amount,
    kind: input.kind || "payment",
    method: input.method,
    reference: input.reference || "",
    notes: input.notes || "",
    gamingDay: booking.gamingDay,
    recordedBy: actor.id,
    recordedByName: actor.name,
  });
  booking.amountPaid = Math.round(nextPaid * 100) / 100;
  booking.paymentStatus = derivePaymentStatus(booking.amountPaid, booking.pricing.finalAmount, input.kind === "refund" || (await hasRefund(String(booking._id))));
  booking.updatedBy = actor.id;
  booking.updatedByName = actor.name;
  await booking.save();
  await writeAudit({
    actor,
    action: input.kind === "refund" ? "payment.refunded" : "payment.recorded",
    entity: "booking",
    entityId: String(booking._id),
    oldValue: before,
    newValue: { ...auditFields(booking), amount: input.amount, method: input.method },
  });
  return { paymentId: String(payment._id), booking: serializeBooking(booking), currency: settings.system.currency };
}

export async function extensionOptions(id: string) {
  const settings = await getSettings();
  const booking = await mustBooking(id);
  if (booking.status !== "active" && booking.status !== "scheduled") {
    throw new AppError(400, "INVALID_STATE", "Only an open booking can be extended.");
  }
  const next = await Booking.findOne({
    stationId: booking.stationId,
    status: { $in: BLOCKING },
    _id: { $ne: booking._id },
    startAt: { $gte: booking.endAt },
  }).sort({ startAt: 1 });
  const availableMinutes = next
    ? Math.max(0, Math.floor((next.startAt.getTime() - booking.endAt.getTime()) / 60000))
    : settings.booking.maxDurationMinutes - booking.durationMinutes;
  const step = settings.booking.durationStepMinutes;
  const maxMore = Math.min(
    availableMinutes - (availableMinutes % step),
    settings.booking.maxDurationMinutes - booking.durationMinutes,
  );
  const options = [30, 60, 120].filter((minutes) => minutes % step === 0 && minutes <= maxMore);
  return {
    step,
    maxMore: Math.max(0, maxMore),
    options,
    limitAt: next ? next.startAt.toISOString() : null,
    blockedBy: next ? clock(next.startAt, settings) : null,
  };
}
