import { AppError } from "@/lib/errors";
import {
  gamingDayLengthMinutes,
  getGamingDay,
  getGamingDayEnd,
  getGamingDayStart,
  listGamingDays,
} from "@/lib/gaming-day";
import { roundMoney } from "@/lib/money";
import { Booking } from "@/models/booking";
import { Customer } from "@/models/customer";
import { Payment } from "@/models/payment";
import { Station } from "@/models/station";
import { getSettings } from "@/services/settings-service";

const PLAYED = ["active", "completed"];

type SummaryRow = {
  bookings: number;
  minutes: number;
  revenue: number;
  discounts: number;
  pending: number;
  controllers: number;
  paid: number;
  partial: number;
  unpaid: number;
  walkIns: number;
  reservations: number;
  customers: Array<string | null>;
};

function emptySummary(): SummaryRow {
  return {
    bookings: 0,
    minutes: 0,
    revenue: 0,
    discounts: 0,
    pending: 0,
    controllers: 0,
    paid: 0,
    partial: 0,
    unpaid: 0,
    walkIns: 0,
    reservations: 0,
    customers: [],
  };
}

function shiftIsoDay(day: string, delta: number) {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + delta)).toISOString().slice(0, 10);
}

function previousComparable(from: string, to: string) {
  if (from.endsWith("-01")) {
    const day = Number(to.slice(8, 10));
    const [year, month] = from.split("-").map(Number);
    const prevStart = new Date(Date.UTC(year, month - 2, 1));
    const prevEndMax = new Date(Date.UTC(year, month - 1, 0));
    const clipped = new Date(Date.UTC(prevStart.getUTCFullYear(), prevStart.getUTCMonth(), day));
    const prevTo = clipped > prevEndMax ? prevEndMax : clipped;
    return { from: prevStart.toISOString().slice(0, 10), to: prevTo.toISOString().slice(0, 10) };
  }
  const days = listGamingDays(from, to).length;
  return { from: shiftIsoDay(from, -days), to: shiftIsoDay(from, -1) };
}

export async function buildReport(from: string, to: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw new AppError(400, "RANGE", "Choose a valid date range.");
  }
  if (from > to) throw new AppError(400, "RANGE", "From date must be on or before to date.");
  const settings = await getSettings();
  const days = listGamingDays(from, to);
  if (days.length >= 400) throw new AppError(400, "RANGE", "Choose a range shorter than 400 gaming days.");
  const hours = settings.operatingHours;
  const dayMinutes = gamingDayLengthMinutes(hours);
  const capacityStations = await Station.countDocuments({ operationalStatus: { $ne: "archived" } });
  const previousRange = previousComparable(from, to);
  const match = { gamingDay: { $gte: from, $lte: to }, status: { $in: PLAYED } };
  const previousMatch = { gamingDay: { $gte: previousRange.from, $lte: previousRange.to }, status: { $in: PLAYED } };

  const [summary, byStation, byType, byDay, volume, played, payments, previous] = await Promise.all([
    Booking.aggregate<SummaryRow>([
      { $match: match },
      {
        $group: {
          _id: null,
          bookings: { $sum: 1 },
          minutes: { $sum: "$durationMinutes" },
          revenue: { $sum: "$pricing.finalAmount" },
          discounts: { $sum: "$pricing.discountAmount" },
          pending: { $sum: { $max: [0, { $subtract: ["$pricing.finalAmount", { $ifNull: ["$amountPaid", 0] }] }] } },
          controllers: { $sum: "$controllerCount" },
          paid: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0] } },
          partial: { $sum: { $cond: [{ $eq: ["$paymentStatus", "partial"] }, 1, 0] } },
          unpaid: { $sum: { $cond: [{ $in: ["$paymentStatus", ["unpaid", "refunded"]] }, 1, 0] } },
          walkIns: { $sum: { $cond: [{ $in: ["$source", ["walk_in", "backdated"]] }, 1, 0] } },
          reservations: { $sum: { $cond: [{ $eq: ["$source", "reservation"] }, 1, 0] } },
          customers: {
            $addToSet: {
              $cond: [
                { $ifNull: ["$customerId", false] },
                { $concat: ["id:", { $toString: "$customerId" }] },
                { $cond: [{ $eq: ["$customerNameLower", ""] }, null, { $concat: ["name:", "$customerNameLower"] }] },
              ],
            },
          },
        },
      },
    ]),
    Booking.aggregate<{ _id: string; name: string; typeName: string; bookings: number; minutes: number; revenue: number }>([
      { $match: match },
      {
        $group: {
          _id: "$stationId",
          name: { $first: "$stationName" },
          typeName: { $first: "$stationTypeName" },
          bookings: { $sum: 1 },
          minutes: { $sum: "$durationMinutes" },
          revenue: { $sum: "$pricing.finalAmount" },
        },
      },
      { $sort: { revenue: -1 } },
    ]),
    Booking.aggregate<{ _id: string; bookings: number; minutes: number; revenue: number }>([
      { $match: match },
      {
        $group: {
          _id: "$stationTypeName",
          bookings: { $sum: 1 },
          minutes: { $sum: "$durationMinutes" },
          revenue: { $sum: "$pricing.finalAmount" },
        },
      },
      { $sort: { revenue: -1 } },
    ]),
    Booking.aggregate<{ _id: string; bookings: number; minutes: number; revenue: number }>([
      { $match: match },
      {
        $group: {
          _id: "$gamingDay",
          bookings: { $sum: 1 },
          minutes: { $sum: "$durationMinutes" },
          revenue: { $sum: "$pricing.finalAmount" },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Booking.aggregate<{ _id: string; bookings: number }>([
      { $match: { gamingDay: { $gte: from, $lte: to }, status: { $ne: "cancelled" } } },
      { $group: { _id: "$gamingDay", bookings: { $sum: 1 } } },
    ]),
    Booking.find(match).select("startAt endAt gamingDay").lean(),
    Payment.aggregate<{ cash: number; online: number; refunds: number }>([
      { $match: { gamingDay: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: null,
          cash: { $sum: { $cond: [{ $and: [{ $eq: ["$kind", "payment"] }, { $eq: ["$method", "cash"] }] }, "$amount", 0] } },
          online: { $sum: { $cond: [{ $and: [{ $eq: ["$kind", "payment"] }, { $ne: ["$method", "cash"] }] }, "$amount", 0] } },
          refunds: { $sum: { $cond: [{ $eq: ["$kind", "refund"] }, "$amount", 0] } },
        },
      },
    ]),
    Booking.aggregate<{ bookings: number; revenue: number }>([
      { $match: previousMatch },
      { $group: { _id: null, bookings: { $sum: 1 }, revenue: { $sum: "$pricing.finalAmount" } } },
    ]),
  ]);

  const totals = summary[0] || emptySummary();
  const moneyMix = payments[0] || { cash: 0, online: 0, refunds: 0 };
  const prior = previous[0] || { bookings: 0, revenue: 0 };
  const dayMap = new Map(byDay.map((row) => [row._id, row]));
  const volumeMap = new Map(volume.map((row) => [row._id, row.bookings]));
  const series = days.map((gamingDay) => ({
    gamingDay,
    bookings: volumeMap.get(gamingDay) || 0,
    playedBookings: dayMap.get(gamingDay)?.bookings || 0,
    minutes: dayMap.get(gamingDay)?.minutes || 0,
    hours: roundMoney((dayMap.get(gamingDay)?.minutes || 0) / 60),
    revenue: roundMoney(dayMap.get(gamingDay)?.revenue || 0),
  }));

  const capacityMinutes = capacityStations * dayMinutes * days.length;
  const stations = byStation.map((row) => ({
    stationId: String(row._id),
    name: row.name,
    typeName: row.typeName,
    bookings: row.bookings,
    minutes: row.minutes,
    hours: roundMoney(row.minutes / 60),
    revenue: roundMoney(row.revenue),
    averageMinutes: row.bookings ? Math.round(row.minutes / row.bookings) : 0,
    utilization: capacityStations
      ? roundMoney((row.minutes / (dayMinutes * days.length)) * 100)
      : 0,
  }));

  const peak = peakHours(played, hours.timezone);

  const monthMap = new Map<string, { revenue: number; minutes: number; bookings: number }>();
  for (const point of series) {
    const month = point.gamingDay.slice(0, 7);
    const current = monthMap.get(month) || { revenue: 0, minutes: 0, bookings: 0 };
    current.revenue += point.revenue;
    current.minutes += point.minutes;
    current.bookings += point.playedBookings;
    monthMap.set(month, current);
  }

  return {
    from,
    to,
    rangeStart: getGamingDayStart(from, hours).toISOString(),
    rangeEnd: getGamingDayEnd(to, hours).toISOString(),
    currency: settings.system.currency,
    currencySymbol: settings.system.currencySymbol,
    today: getGamingDay(new Date(), hours),
    previous: {
      from: previousRange.from,
      to: previousRange.to,
      bookings: prior.bookings,
      revenue: roundMoney(prior.revenue),
    },
    summary: {
      bookings: totals.bookings,
      bookingCount: series.reduce((sum, point) => sum + point.bookings, 0),
      minutes: totals.minutes,
      hours: roundMoney(totals.minutes / 60),
      revenue: roundMoney(totals.revenue),
      discounts: roundMoney(totals.discounts),
      pending: roundMoney(totals.pending),
      cash: roundMoney(moneyMix.cash),
      online: roundMoney(moneyMix.online),
      refunds: roundMoney(moneyMix.refunds),
      netRevenue: roundMoney(totals.revenue - moneyMix.refunds),
      averageMinutes: totals.bookings ? Math.round(totals.minutes / totals.bookings) : 0,
      averageRevenue: totals.bookings ? roundMoney(totals.revenue / totals.bookings) : 0,
      controllerUses: totals.controllers,
      averageControllers: totals.bookings ? roundMoney(totals.controllers / totals.bookings) : 0,
      utilization: capacityMinutes ? roundMoney((totals.minutes / capacityMinutes) * 100) : 0,
      paid: totals.paid,
      partial: totals.partial,
      unpaid: totals.unpaid,
      walkIns: totals.walkIns,
      reservations: totals.reservations,
      uniqueCustomers: totals.customers.filter(Boolean).length,
    },
    stations,
    byType: byType.map((row) => ({
      typeName: row._id || "Unknown",
      bookings: row.bookings,
      hours: roundMoney(row.minutes / 60),
      revenue: roundMoney(row.revenue),
    })),
    series,
    months: [...monthMap.entries()].map(([month, value]) => ({
      month,
      revenue: roundMoney(value.revenue),
      hours: roundMoney(value.minutes / 60),
      bookings: value.bookings,
    })),
    peak,
  };
}

function peakHours(bookings: { startAt: Date; endAt: Date }[], timezone: string) {
  const counts = new Map<string, number>();
  for (const booking of bookings) {
    let cursor = new Date(booking.startAt);
    const end = new Date(booking.endAt);
    while (cursor < end) {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(cursor);
      const hour = parts.find((part) => part.type === "hour")?.value || "00";
      const minute = Number(parts.find((part) => part.type === "minute")?.value || "0");
      const label = `${hour}:${minute < 30 ? "00" : "30"}`;
      counts.set(label, (counts.get(label) || 0) + 1);
      cursor = new Date(cursor.getTime() + 30 * 60_000);
    }
  }
  return [...counts.entries()]
    .map(([time, sessions]) => ({ time, sessions }))
    .sort((a, b) => a.time.localeCompare(b.time));
}

export async function allTimeStats() {
  const settings = await getSettings();
  const nowDay = getGamingDay(new Date(), settings.operatingHours);
  const [played, customers, mostUsed, highestRevenue, first] = await Promise.all([
    Booking.aggregate<{ bookings: number; minutes: number; revenue: number }>([
      { $match: { status: { $in: PLAYED } } },
      { $group: { _id: null, bookings: { $sum: 1 }, minutes: { $sum: "$durationMinutes" }, revenue: { $sum: "$pricing.finalAmount" } } },
    ]),
    Customer.countDocuments({ archived: false }),
    Booking.aggregate<{ name: string; minutes: number }>([
      { $match: { status: { $in: PLAYED } } },
      { $group: { _id: "$stationId", name: { $first: "$stationName" }, minutes: { $sum: "$durationMinutes" } } },
      { $sort: { minutes: -1 } },
      { $limit: 1 },
    ]),
    Booking.aggregate<{ name: string; revenue: number }>([
      { $match: { status: { $in: PLAYED } } },
      { $group: { _id: "$stationId", name: { $first: "$stationName" }, revenue: { $sum: "$pricing.finalAmount" } } },
      { $sort: { revenue: -1 } },
      { $limit: 1 },
    ]),
    Booking.findOne({ status: { $ne: "cancelled" } }).sort({ gamingDay: 1 }).select("gamingDay").lean(),
  ]);
  const totals = played[0] || { bookings: 0, minutes: 0, revenue: 0 };
  const span = first?.gamingDay ? listGamingDays(first.gamingDay, nowDay).length : 0;
  return {
    currencySymbol: settings.system.currencySymbol,
    totalBookings: totals.bookings,
    totalHours: roundMoney(totals.minutes / 60),
    totalRevenue: roundMoney(totals.revenue),
    totalCustomers: customers,
    mostUsedStation: mostUsed[0] ? { name: mostUsed[0].name, hours: roundMoney(mostUsed[0].minutes / 60) } : null,
    highestRevenueStation: highestRevenue[0]
      ? { name: highestRevenue[0].name, revenue: roundMoney(highestRevenue[0].revenue) }
      : null,
    averageMinutes: totals.bookings ? Math.round(totals.minutes / totals.bookings) : 0,
    averageRevenue: totals.bookings ? roundMoney(totals.revenue / totals.bookings) : 0,
    gamingDays: span,
  };
}
