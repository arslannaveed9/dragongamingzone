import { matchesSchedule, type DiscountLike } from "@/lib/pricing";
import {
  getGamingDayEnd,
  getGamingDayInfo,
  getGamingDayStart,
  getNextGamingDay,
} from "@/lib/gaming-day";
import { Discount } from "@/models/discount";
import { Booking } from "@/models/booking";
import { Station } from "@/models/station";
import { loadPriceCatalog, quoteWithCatalog } from "@/services/quote-service";
import { remainingMs } from "@/services/booking-service";
import { getSettings } from "@/services/settings-service";
import { sweepExpiredSessions } from "@/services/sweep-service";

type LiveBooking = {
  _id: unknown;
  bookingNumber: string;
  customerName: string;
  stationId: unknown;
  status: string;
  startAt: Date;
  endAt: Date;
  durationMinutes: number;
  controllerCount: number;
  pausedAt?: Date | null;
  paymentStatus: string;
  amountPaid: number;
  pricing: { finalAmount: number };
};

function discountPlain(doc: {
  _id: unknown;
  name: string;
  type: "percentage" | "fixed";
  value: number;
  startTime?: string | null;
  endTime?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  daysOfWeek?: number[];
  stationIds?: unknown[];
  stationTypeIds?: unknown[];
  minDurationMinutes?: number | null;
  active?: boolean;
}): DiscountLike {
  return {
    id: String(doc._id),
    name: doc.name,
    type: doc.type,
    value: doc.value,
    startTime: doc.startTime,
    endTime: doc.endTime,
    startDate: doc.startDate,
    endDate: doc.endDate,
    daysOfWeek: doc.daysOfWeek || [],
    stationIds: (doc.stationIds || []).map(String),
    stationTypeIds: (doc.stationTypeIds || []).map(String),
    minDurationMinutes: doc.minDurationMinutes,
    priority: 0,
    active: doc.active !== false,
  };
}

export async function getLiveBoard(gamingDay?: string) {
  await sweepExpiredSessions();
  const settings = await getSettings();
  const now = new Date();
  const info = getGamingDayInfo(now, settings.operatingHours);
  const day = gamingDay || info.gamingDay;
  const dayStart = getGamingDayStart(day, settings.operatingHours);
  const dayEnd = getGamingDayEnd(day, settings.operatingHours);
  const priceAt = info.withinHours ? now : getGamingDayStart(getNextGamingDay(info.gamingDay), settings.operatingHours);
  const [stations, bookings, catalog, discountRows] = await Promise.all([
    Station.find({ operationalStatus: { $ne: "archived" } }).sort({ sortOrder: 1, name: 1 }).populate("typeId").lean(),
    Booking.find({ gamingDay: day, status: { $in: ["scheduled", "active", "completed"] } }).sort({ startAt: 1 }).lean(),
    loadPriceCatalog(),
    Discount.find({ active: true }).lean(),
  ]);

  const visibleDiscounts = discountRows
    .map((row) => discountPlain(row as never))
    .filter((discount) => {
      if (discount.startDate && day < discount.startDate) return false;
      if (discount.endDate && day > discount.endDate) return false;
      return true;
    });

  const byStation = new Map<string, LiveBooking[]>();
  for (const booking of bookings as unknown as LiveBooking[]) {
    const key = String(booking.stationId);
    const list = byStation.get(key) || [];
    list.push(booking);
    byStation.set(key, list);
  }

  const cards = stations.map((station) => {
    const type = station.typeId as { _id?: unknown; name?: string };
    const typeId = String(type?._id ?? station.typeId);
    const typeName = type?.name || "Station";
    const rows = byStation.get(String(station._id)) || [];
    const occupancy = rows.filter((row) => row.status === "active" || row.status === "scheduled");
    const inWindow = occupancy.find((row) => new Date(row.startAt) <= now && new Date(row.endAt) > now) || null;
    const overtime = occupancy.find((row) => row.status === "active" && new Date(row.endAt) <= now) || null;
    const current = inWindow || overtime;
    const next = occupancy
      .filter((row) => new Date(row.startAt) > now)
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())[0] || null;
    let status: "available" | "playing" | "paused" | "reserved" | "disabled" | "maintenance" = "available";
    if (station.operationalStatus === "disabled") status = "disabled";
    else if (station.operationalStatus === "maintenance") status = "maintenance";
    else if (current?.status === "active" && current.pausedAt) status = "paused";
    else if (current?.status === "active") status = "playing";
    else if (current?.status === "scheduled") status = "reserved";

    const quote30 = quoteWithCatalog(
      {
        stationId: String(station._id),
        stationTypeId: typeId,
        pricing: station.pricing,
        startAt: priceAt,
        durationMinutes: 30,
        controllerCount: 1,
        gamingDay: info.withinHours ? info.gamingDay : getNextGamingDay(info.gamingDay),
        settings,
      },
      catalog,
    );
    const quote60 = quoteWithCatalog(
      {
        stationId: String(station._id),
        stationTypeId: typeId,
        pricing: station.pricing,
        startAt: priceAt,
        durationMinutes: 60,
        controllerCount: 1,
        gamingDay: info.withinHours ? info.gamingDay : getNextGamingDay(info.gamingDay),
        settings,
      },
      catalog,
    );

    return {
      id: String(station._id),
      name: station.name,
      description: station.description || "",
      typeId,
      typeName,
      operationalStatus: station.operationalStatus,
      status,
      maxControllers: station.maxControllers,
      pricing: {
        per30Min: station.pricing.per30Min,
        perHour: station.pricing.perHour,
        additionalPer30Min: station.pricing.additionalPer30Min ?? 0,
        additionalPerHour: station.pricing.additionalPerHour ?? 0,
        current30: quote30.finalAmount,
        current60: quote60.finalAmount,
        discount30: quote30.appliedDiscount?.name || null,
        discount60: quote60.appliedDiscount?.name || null,
      },
      current: current
        ? {
            bookingId: String(current._id),
            bookingNumber: current.bookingNumber,
            customerName: current.customerName,
            controllerCount: current.controllerCount,
            startAt: new Date(current.startAt).toISOString(),
            endAt: new Date(current.endAt).toISOString(),
            finalAmount: current.pricing.finalAmount,
            amountPaid: current.amountPaid || 0,
            paymentStatus: current.paymentStatus || "unpaid",
            durationMinutes: current.durationMinutes,
            paused: Boolean(current.pausedAt),
            remainingMs: remainingMs(current, now),
          }
        : null,
      next: next
        ? {
            bookingId: String(next._id),
            customerName: next.customerName,
            startAt: new Date(next.startAt).toISOString(),
            endAt: new Date(next.endAt).toISOString(),
            durationMinutes: next.durationMinutes,
            amountPaid: next.amountPaid || 0,
            paymentStatus: next.paymentStatus || "unpaid",
            finalAmount: next.pricing.finalAmount,
          }
        : null,
      nextAvailableAt: current ? new Date(current.endAt).toISOString() : null,
      timeline: rows.filter((row) => row.status === "scheduled" || row.status === "active").map((row) => ({
        bookingId: String(row._id),
        bookingNumber: row.bookingNumber,
        customerName: row.customerName,
        status: row.status,
        startAt: new Date(row.startAt).toISOString(),
        endAt: new Date(row.endAt).toISOString(),
        controllerCount: row.controllerCount,
      })),
    };
  });

  const activeNow = visibleDiscounts.filter((discount) =>
    cards.some((card) =>
      matchesSchedule(discount, {
        stationId: card.id,
        stationTypeId: card.typeId,
        gamingDay: info.withinHours ? info.gamingDay : day,
        timezone: settings.operatingHours.timezone,
        startAt: priceAt,
        durationMinutes: discount.minDurationMinutes || 30,
      }),
    ),
  );

  return {
    serverNow: now.toISOString(),
    gamingDay: day,
    withinHours: info.withinHours && day === info.gamingDay,
    closedGap: info.closedGap,
    dayStart: dayStart.toISOString(),
    dayEnd: dayEnd.toISOString(),
    settings,
    stations: cards,
    discounts: visibleDiscounts,
    activeDiscounts: activeNow,
    counts: {
      total: cards.filter((card) => card.operationalStatus === "active").length,
      playing: cards.filter((card) => card.status === "playing" || card.status === "paused").length,
      available: cards.filter((card) => card.status === "available").length,
      reserved: cards.filter((card) => card.status === "reserved").length,
    },
  };
}

export function toPublicBoard<T extends Awaited<ReturnType<typeof getLiveBoard>>>(board: T) {
  return {
    ...board,
    stations: board.stations.map((station) => ({
      ...station,
      current: station.current
        ? {
            bookingId: station.current.bookingId,
            customerName: station.current.customerName,
            controllerCount: station.current.controllerCount,
            startAt: station.current.startAt,
            endAt: station.current.endAt,
            paused: station.current.paused,
            remainingMs: station.current.remainingMs,
          }
        : null,
      next: station.next ? { startAt: station.next.startAt, endAt: station.next.endAt } : null,
      timeline: station.timeline.map((block) => ({
        bookingId: block.bookingId,
        status: block.status,
        startAt: block.startAt,
        endAt: block.endAt,
        customerName: block.status === "active" ? block.customerName : "",
      })),
    })),
  };
}
