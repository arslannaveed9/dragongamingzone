"use client";

import Link from "next/link";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { chartTooltip, figure, formatDuration, notifyRefresh, openBooking, usePoll, api } from "@/components/admin/client";
import { FiguresLock } from "@/components/admin/figures-lock";
import { StationBoard } from "@/components/admin/station-board";
import { StatusPill } from "@/components/admin/status-pill";
import { Countdown } from "@/components/admin/countdown";
import { formatClock } from "@/lib/gaming-day";

type DashboardData = {
  gamingDay: string;
  withinHours: boolean;
  closedGap: boolean;
  serverNow: string;
  currencySymbol: string;
  timezone: string;
  timeFormat: "12h" | "24h";
  counts: { total: number; playing: number; available: number; reserved: number };
  figures: { unlocked: boolean; configured: boolean };
  today: { bookings: number; hours: number; revenue: number | null; collected: number | null; pending: number | null };
  activeSessions: {
    id: string;
    name: string;
    current: null | { bookingId: string; customerName: string; endAt: string; paused: boolean; remainingMs: number; finalAmount: number | null };
  }[];
  upcoming: { id: string; bookingNumber: string; customerName: string; stationName: string; startAt: string; durationMinutes: number; gamingDay: string }[];
  recent: { id: string; bookingNumber: string; customerName: string; stationName: string; status: string; finalAmount: number | null }[];
  trend: { gamingDay: string; revenue: number | null; hours: number }[];
  inquiries: { id: string; name: string; message: string }[];
};

export function DashboardView() {
  const { data, loading, error } = usePoll<DashboardData>("/api/dashboard", 10000);
  const symbol = data?.currencySymbol || "Rs";

  async function startEarly(id: string) {
    try {
      await api(`/api/bookings/${id}/actions`, { method: "POST", body: JSON.stringify({ type: "start", force: true }) });
      toast.success("Started now. Booked time runs from this moment.");
      notifyRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start the booking.");
    }
  }

  if (loading && !data) return <p className="text-sm text-muted-foreground">Loading the floor...</p>;
  if (!data) return <p className="text-sm text-destructive">{error || "Could not load the dashboard."}</p>;

  const cards = [
    ["Active stations", String(data.counts.total), "border-l-cyan-300"],
    ["Today's bookings", String(data.today.bookings), "border-l-sky-400"],
    ["Today's revenue", figure(data.today.revenue, symbol), "border-l-emerald-300"],
    ["Pending payments", figure(data.today.pending, symbol), "border-l-amber-300"],
  ] as const;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="gz-kicker text-cyan-800 dark:text-cyan-200">Floor</p>
          <h1 className="gz-title">Dashboard</h1>
          <p className="mt-1 text-base text-muted-foreground">Gaming day {data.gamingDay}{data.closedGap ? " · outside operating hours" : ""}</p>
        </div>
        <div className="flex gap-2">
          <FiguresLock unlocked={data.figures.unlocked} configured={data.figures.configured} />
          <Button onClick={() => openBooking({ mode: "walk_in" })}>New walk-in</Button>
          <Button variant="outline" onClick={() => openBooking({ mode: "reservation", gamingDay: data.gamingDay })}>New booking</Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map(([label, value, wash]) => (
          <div key={label} className={`gz-panel border-l-4 ${wash} px-4 py-4`}>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 font-heading text-3xl font-bold tabular-nums text-foreground">{value}</p>
          </div>
        ))}
      </div>
      <StationBoard />
      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 font-heading text-lg font-semibold">Revenue, last 7 gaming days</h2>
          {data.figures.unlocked ? (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.trend}>
                  <XAxis dataKey="gamingDay" tick={{ fill: "oklch(0.74 0.015 250)", fontSize: 11 }} tickFormatter={(value) => String(value).slice(5)} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "oklch(0.74 0.015 250)", fontSize: 11 }} width={40} axisLine={false} tickLine={false} />
                  <Tooltip {...chartTooltip} />
                  <Bar dataKey="revenue" fill="var(--chart-1)" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="flex h-52 items-center justify-center text-sm text-muted-foreground">Hidden until the figures password is entered.</p>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-medium">Active sessions</h2>
          <div className="space-y-2">
            {data.activeSessions.length === 0 && <p className="text-sm text-muted-foreground">Nobody is playing right now.</p>}
            {data.activeSessions.map((station) => station.current && (
              <div key={station.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{station.name} · {station.current.customerName}</p>
                  <p className="text-xs text-muted-foreground">{figure(station.current.finalAmount, symbol)}</p>
                </div>
                <Countdown endAt={station.current.endAt} paused={station.current.paused} remainingMs={station.current.remainingMs} serverNow={data.serverNow} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-medium">Upcoming</h2>
          {data.upcoming.length === 0 && <p className="text-sm text-muted-foreground">No upcoming reservations.</p>}
          {data.upcoming.map((booking) => (
            <div key={booking.id} className="flex items-center justify-between gap-3 border-b border-border py-2 text-sm last:border-0">
              <Link href={`/dashboard/bookings/${booking.id}`} className="min-w-0 hover:text-primary">
                <span className="block truncate">{booking.customerName} · {booking.stationName}</span>
                <span className="text-xs text-muted-foreground">{formatDuration(booking.durationMinutes)} booked · {formatClock(new Date(booking.startAt), data.timezone, data.timeFormat)}</span>
              </Link>
              <Button size="sm" onClick={() => startEarly(booking.id)}>Start early</Button>
            </div>
          ))}
        </section>
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-medium">Recent bookings</h2>
          {data.recent.length === 0 && <p className="text-sm text-muted-foreground">No bookings yet today.</p>}
          {data.recent.map((booking) => (
            <Link key={booking.id} href={`/dashboard/bookings/${booking.id}`} className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0">
              <span>{booking.bookingNumber} · {booking.customerName}</span>
              <StatusPill status={booking.status} />
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}
