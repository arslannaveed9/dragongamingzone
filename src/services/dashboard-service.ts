import { figuresUnlocked } from "@/lib/figures";
import { getGamingDay, getPreviousGamingDay, shiftGamingDay } from "@/lib/gaming-day";
import { figuresPasswordConfigured } from "@/services/settings-service";
import { Booking } from "@/models/booking";
import { ContactInquiry } from "@/models/contact";
import { getLiveBoard } from "@/services/live-service";
import { getSettings } from "@/services/settings-service";

export async function getDashboard() {
  const settings = await getSettings();
  const now = new Date();
  const gamingDay = getGamingDay(now, settings.operatingHours);
  const board = await getLiveBoard(gamingDay);
  const from = shiftGamingDay(gamingDay, -6);
  const [today, pendingRows, upcoming, recent, trend, inquiries, unlocked, configured] = await Promise.all([
    Booking.aggregate<{ bookings: number; minutes: number; revenue: number; collected: number }>([
      { $match: { gamingDay, status: { $in: ["active", "completed", "scheduled"] } } },
      {
        $group: {
          _id: null,
          bookings: { $sum: 1 },
          minutes: {
            $sum: { $cond: [{ $in: ["$status", ["active", "completed"]] }, "$durationMinutes", 0] },
          },
          revenue: {
            $sum: { $cond: [{ $in: ["$status", ["active", "completed"]] }, "$pricing.finalAmount", 0] },
          },
          collected: { $sum: "$amountPaid" },
        },
      },
    ]),
    Booking.aggregate<{ pending: number }>([
      { $match: { gamingDay, status: "active" } },
      {
        $group: {
          _id: null,
          pending: { $sum: { $max: [0, { $subtract: ["$pricing.finalAmount", "$amountPaid"] }] } },
        },
      },
    ]),
    Booking.find({ status: "scheduled", startAt: { $gte: now } }).sort({ startAt: 1 }).limit(8).lean(),
    Booking.find().sort({ createdAt: -1 }).limit(8).lean(),
    Booking.aggregate<{ _id: string; revenue: number; minutes: number }>([
      { $match: { gamingDay: { $gte: from, $lte: gamingDay }, status: { $in: ["active", "completed"] } } },
      { $group: { _id: "$gamingDay", revenue: { $sum: "$pricing.finalAmount" }, minutes: { $sum: "$durationMinutes" } } },
    ]),
    ContactInquiry.find().sort({ createdAt: -1 }).limit(5).lean(),
    figuresUnlocked(),
    figuresPasswordConfigured(),
  ]);
  const trendMap = new Map(trend.map((row) => [row._id, row]));
  const days = Array.from({ length: 7 }, (_, index) => shiftGamingDay(from, index));
  const row = today[0] || { bookings: 0, minutes: 0, revenue: 0, collected: 0 };
  const pending = pendingRows[0]?.pending || 0;
  const show = unlocked && configured;
  return {
    gamingDay,
    previousGamingDay: getPreviousGamingDay(gamingDay),
    withinHours: board.withinHours,
    closedGap: board.closedGap,
    serverNow: board.serverNow,
    currencySymbol: settings.system.currencySymbol,
    timezone: settings.operatingHours.timezone,
    timeFormat: settings.system.timeFormat,
    counts: board.counts,
    figures: { unlocked: show, configured },
    today: {
      bookings: row.bookings,
      hours: Math.round((row.minutes / 60) * 10) / 10,
      revenue: show ? row.revenue : null,
      collected: show ? row.collected : null,
      pending: show ? pending : null,
    },
    activeSessions: board.stations
      .filter((station) => station.current && (station.status === "playing" || station.status === "paused"))
      .map((station) => ({
        ...station,
        current: station.current ? { ...station.current, finalAmount: show ? station.current.finalAmount : null } : null,
      })),
    upcoming: upcoming.map((booking) => ({
      id: String(booking._id),
      bookingNumber: booking.bookingNumber,
      customerName: booking.customerName,
      stationName: booking.stationName,
      startAt: booking.startAt,
      endAt: booking.endAt,
      durationMinutes: booking.durationMinutes,
      gamingDay: booking.gamingDay,
    })),
    recent: recent.map((booking) => ({
      id: String(booking._id),
      bookingNumber: booking.bookingNumber,
      customerName: booking.customerName,
      stationName: booking.stationName,
      status: booking.status,
      finalAmount: show ? booking.pricing.finalAmount : null,
      createdAt: booking.createdAt,
    })),
    trend: days.map((day) => ({
      gamingDay: day,
      revenue: show ? trendMap.get(day)?.revenue || 0 : null,
      hours: Math.round(((trendMap.get(day)?.minutes || 0) / 60) * 10) / 10,
    })),
    inquiries: inquiries.map((item) => ({
      id: String(item._id),
      name: item.name,
      phone: item.phone,
      message: item.message,
      createdAt: item.createdAt,
    })),
  };
}
