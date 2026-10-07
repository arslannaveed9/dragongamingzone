"use client";

import { useState, type ReactNode } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Banknote, Calendar, ChevronLeft, ChevronRight, Clock, Download, Gamepad2, Percent, TrendingUp, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { chartTooltip, formatDuration, money, usePoll } from "@/components/admin/client";
import { parseReportCsv, reportToCsv, type CsvDay } from "@/lib/report-csv";

type Report = {
  from: string;
  to: string;
  today: string;
  currencySymbol: string;
  previous: { from: string; to: string; revenue: number; bookings: number };
  summary: {
    bookings: number;
    hours: number;
    revenue: number;
    discounts: number;
    pending: number;
    cash: number;
    online: number;
    refunds: number;
    netRevenue: number;
    averageMinutes: number;
    averageRevenue: number;
    controllerUses: number;
    averageControllers: number;
    utilization: number;
    paid: number;
    partial: number;
    unpaid: number;
    walkIns: number;
    reservations: number;
    uniqueCustomers: number;
  };
  stations: { stationId: string; name: string; typeName: string; bookings: number; hours: number; revenue: number; averageMinutes: number; utilization: number }[];
  byType: { typeName: string; bookings: number; hours: number; revenue: number }[];
  series: { gamingDay: string; revenue: number; hours: number; bookings: number }[];
  months: { month: string; revenue: number; hours: number; bookings: number }[];
  peak: { time: string; sessions: number }[];
};

type AllTime = {
  currencySymbol: string;
  totalBookings: number;
  totalHours: number;
  totalRevenue: number;
  totalCustomers: number;
  mostUsedStation: { name: string; hours: number } | null;
  highestRevenueStation: { name: string; revenue: number } | null;
  averageMinutes: number;
  averageRevenue: number;
};

type Mode = "month" | "today" | "year" | "custom";

export default function ReportsPage() {
  const [mode, setMode] = useState<Mode>("month");
  const [month, setMonth] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [imported, setImported] = useState<CsvDay[] | null>(null);
  const customReady = mode === "custom" && Boolean(from && to);
  const detailUrl = mode === "custom"
    ? (customReady ? `/api/reports?from=${from}&to=${to}` : null)
    : mode === "today"
      ? "/api/reports?preset=today"
      : mode === "year"
        ? "/api/reports?preset=year"
        : month
          ? `/api/reports?from=${monthBounds(month).from}&to=${monthBounds(month).to}`
          : "/api/reports?preset=month";
  const report = usePoll<Report>(detailUrl);
  const allTime = usePoll<AllTime>("/api/reports?scope=all-time");
  const data = report.data;
  const symbol = data?.currencySymbol || "Rs";
  const activeMonth = month || data?.from.slice(0, 7) || "";
  const monthName = activeMonth ? monthLabel(activeMonth) : "This month";
  const atCurrentMonth = Boolean(data?.today && activeMonth >= data.today.slice(0, 7));

  function download() {
    if (!data) return;
    const blob = new Blob([reportToCsv(data)], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `gaming-zone-${data.from}-to-${data.to}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function onImport(file: File) {
    const days = parseReportCsv(await file.text());
    if (days.length === 0) {
      toast.error("No daily rows found. Use a CSV exported from this page, or columns date, bookings, hours, revenue.");
      return;
    }
    setImported(days);
    toast.success(`Imported ${days.length} gaming days.`);
  }

  function goMonth(delta: number) {
    const base = month || data?.from.slice(0, 7);
    if (!base) return;
    const next = shiftMonth(base, delta);
    if (data?.today && next > data.today.slice(0, 7)) return;
    setMode("month");
    setMonth(next);
  }

  const summary = data?.summary;
  const chartTitle = mode === "month" ? `Daily Revenue · ${monthName}` : data ? `Daily Revenue · ${data.from} to ${data.to}` : "Daily Revenue";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="gz-title">Revenue Reports</h1>
          <p className="mt-1 text-base text-muted-foreground">Analyze your gaming zone performance</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="icon" aria-label="Previous month" onClick={() => goMonth(-1)} disabled={!data}>
            <ChevronLeft />
          </Button>
          <div className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium">
            <Calendar className="size-4 text-cyan-600 dark:text-cyan-300" />
            {mode === "month" ? monthName : mode === "today" ? "Today" : mode === "year" ? "Last 12 months" : "Custom range"}
          </div>
          <Button type="button" variant="outline" size="icon" aria-label="Next month" onClick={() => goMonth(1)} disabled={!data || (mode === "month" && atCurrentMonth)}>
            <ChevronRight />
          </Button>
          <Button onClick={download} disabled={!data}><Download /> Export</Button>
          <label className="inline-flex h-10 cursor-pointer items-center rounded-lg border border-input px-3.5 text-sm font-medium hover:bg-muted">
            Import
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void onImport(file);
              }}
            />
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["month", "today", "year", "custom"] as const).map((value) => (
          <Button key={value} type="button" variant={mode === value ? "default" : "outline"} onClick={() => { setMode(value); if (value === "month") setMonth(null); }}>
            {value === "month" ? "This month" : value === "today" ? "Today" : value === "year" ? "Last 12 months" : "Custom"}
          </Button>
        ))}
        {mode === "custom" && (
          <div className="flex flex-wrap items-center gap-2">
            <Input type="date" aria-label="From gaming day" value={from} onChange={(event) => setFrom(event.target.value)} className="w-full sm:w-44" />
            <span className="text-muted-foreground">to</span>
            <Input type="date" aria-label="To gaming day" value={to} onChange={(event) => setTo(event.target.value)} className="w-full sm:w-44" />
          </div>
        )}
      </div>

      {mode === "custom" && !customReady && <p className="text-base text-muted-foreground">Choose a start and end gaming day.</p>}
      {report.error && <p className="text-base text-destructive">{report.error}</p>}

      {summary && data && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={<Wallet className="size-4" />} label="Total Revenue" value={money(summary.revenue, symbol)} hint={<Delta current={summary.revenue} previous={data.previous.revenue} text={`vs ${money(data.previous.revenue, symbol)} ${mode === "month" ? "last month" : "previous period"}`} />} />
          <Metric icon={<Users className="size-4" />} label="Total Bookings" value={String(summary.bookings)} hint={<Delta current={summary.bookings} previous={data.previous.bookings} text={`vs ${data.previous.bookings} ${mode === "month" ? "last month" : "previous period"}`} />} />
          <Metric icon={<TrendingUp className="size-4" />} label="Avg Booking Value" value={money(summary.averageRevenue, symbol)} hint={<span>{summary.averageMinutes} min avg duration</span>} />
          <Metric icon={<Clock className="size-4" />} label="Total Hours" value={`${summary.hours}h`} valueClass="text-amber-500" hint={<span>{money(summary.pending, symbol)} pending</span>} />
          <Metric icon={<Banknote className="size-4" />} label="Cash Revenue" value={money(summary.cash, symbol)} hint={<span>{share(summary.cash, summary.cash + summary.online)} of collected</span>} />
          <Metric icon={<Wallet className="size-4" />} label="Online Revenue" value={money(summary.online, symbol)} hint={<span>{share(summary.online, summary.cash + summary.online)} of collected</span>} />
          <Metric icon={<TrendingUp className="size-4" />} label="Net Revenue" value={money(summary.netRevenue, symbol)} valueClass="text-emerald-500" hint={<span>After {money(summary.refunds, symbol)} refunds</span>} />
          <Metric icon={<Percent className="size-4" />} label="Total Discounts" value={money(summary.discounts, symbol)} valueClass="text-amber-500" hint={<span>Across {summary.bookings} bookings</span>} />
          <Metric icon={<Users className="size-4" />} label="Unique Customers" value={String(summary.uniqueCustomers)} hint={<span>{summary.walkIns} walk-in · {summary.reservations} pre-booked</span>} />
          <Metric icon={<TrendingUp className="size-4" />} label="Payment Status" value={`${summary.paid} paid`} hint={<span>{summary.partial} partial · {summary.unpaid} unpaid</span>} />
          <Metric icon={<Gamepad2 className="size-4" />} label="Controllers Used" value={String(summary.controllerUses)} hint={<span>{summary.averageControllers} avg per booking</span>} />
        </div>
      )}

      <Tabs defaultValue="daily">
        <TabsList className="h-11">
          <TabsTrigger className="px-4 text-base" value="daily">Daily Trend</TabsTrigger>
          <TabsTrigger className="px-4 text-base" value="station">By Station</TabsTrigger>
          <TabsTrigger className="px-4 text-base" value="breakdown">Breakdown</TabsTrigger>
        </TabsList>
        <TabsContent value="daily" className="mt-3">
          <TrendChart title={chartTitle} data={data?.series || []} dataKey="revenue" symbol={symbol} />
        </TabsContent>
        <TabsContent value="station" className="mt-3 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <StationChart title="Revenue by station" data={data?.stations || []} dataKey="revenue" color="var(--chart-1)" symbol={symbol} />
            <StationChart title="Hours by station" data={data?.stations || []} dataKey="hours" color="var(--chart-3)" />
          </div>
          <StationTable stations={data?.stations || []} symbol={symbol} />
        </TabsContent>
        <TabsContent value="breakdown" className="mt-3 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <TrendChart title="Hours played" data={data?.series || []} dataKey="hours" />
            <TrendChart title="Bookings" data={data?.series || []} dataKey="bookings" />
            <BarBlock title="Peak times" data={data?.peak || []} dataKey="sessions" x="time" color="var(--chart-3)" />
            <BarBlock title="By station type" data={data?.byType || []} dataKey="revenue" x="typeName" color="var(--chart-2)" />
          </div>
          {allTime.data && (
            <section className="gz-panel p-5">
              <h2 className="mb-4 font-heading text-xl font-semibold">All time</h2>
              <div className="grid grid-cols-2 gap-4 text-base md:grid-cols-4">
                <Stat label="Bookings" value={String(allTime.data.totalBookings)} />
                <Stat label="Hours" value={String(allTime.data.totalHours)} />
                <Stat label="Revenue" value={money(allTime.data.totalRevenue, allTime.data.currencySymbol)} />
                <Stat label="Customers" value={String(allTime.data.totalCustomers)} />
                <Stat label="Most played" value={allTime.data.mostUsedStation ? `${allTime.data.mostUsedStation.name} (${allTime.data.mostUsedStation.hours} h)` : "—"} />
                <Stat label="Highest revenue" value={allTime.data.highestRevenueStation ? `${allTime.data.highestRevenueStation.name} (${money(allTime.data.highestRevenueStation.revenue, allTime.data.currencySymbol)})` : "—"} />
                <Stat label="Avg duration" value={formatDuration(allTime.data.averageMinutes)} />
                <Stat label="Avg revenue" value={money(allTime.data.averageRevenue, allTime.data.currencySymbol)} />
              </div>
            </section>
          )}
        </TabsContent>
      </Tabs>

      {imported && (
        <section className="gz-panel p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Imported file</h2>
            <Button variant="ghost" onClick={() => setImported(null)}>Clear</Button>
          </div>
          <TrendChart title="Imported daily revenue" data={imported} dataKey="revenue" symbol={symbol} />
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-base">
              <thead className="text-sm text-muted-foreground"><tr><th className="py-2">Gaming day</th><th>Bookings</th><th>Hours</th><th>Revenue</th></tr></thead>
              <tbody>
                {imported.map((day) => (
                  <tr key={day.gamingDay} className="border-t border-border">
                    <td className="py-2">{day.gamingDay}</td>
                    <td>{day.bookings}</td>
                    <td>{day.hours}</td>
                    <td>{money(day.revenue, symbol)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function Metric({ icon, label, value, hint, valueClass = "" }: { icon: ReactNode; label: string; value: string; hint?: ReactNode; valueClass?: string }) {
  return (
    <div className="gz-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className="grid size-8 place-items-center rounded-lg bg-cyan-500/15 text-cyan-700 dark:text-cyan-300">{icon}</span>
      </div>
      <p className={`mt-2 font-heading text-2xl font-bold tabular-nums ${valueClass}`}>{value}</p>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Delta({ current, previous, text }: { current: number; previous: number; text: string }) {
  if (!previous) return <span>No earlier period to compare</span>;
  const diff = ((current - previous) / previous) * 100;
  const down = diff < 0;
  return (
    <span className={down ? "text-rose-500" : "text-emerald-500"}>
      {down ? "↓" : "↑"} {Math.abs(diff).toFixed(1)}% <span className="text-muted-foreground">{text}</span>
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <p className="text-muted-foreground">{label}<br /><strong className="font-heading text-xl text-foreground">{value}</strong></p>;
}

function share(part: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

function monthLabel(ym: string) {
  const [year, month] = ym.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function monthBounds(ym: string) {
  const [year, month] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return { from: `${ym}-01`, to: last };
}

function shiftMonth(ym: string, delta: number) {
  const [year, month] = ym.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + delta, 1)).toISOString().slice(0, 7);
}

function axisTick(value: string | number) {
  const text = String(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text.slice(8) : text;
}

function TrendChart({ title, data, dataKey, symbol }: { title: string; data: object[]; dataKey: string; symbol?: string }) {
  return (
    <div className="gz-panel p-4">
      <h2 className="mb-3 font-heading text-lg font-semibold">{title}</h2>
      <div className="h-72">
        {data.length === 0 ? <p className="flex h-full items-center text-muted-foreground">No figures in this range yet.</p> : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="gamingDay" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} tickFormatter={axisTick} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} width={56} axisLine={false} tickLine={false} tickFormatter={(value) => symbol ? `${symbol}${value}` : String(value)} />
              <Tooltip {...chartTooltip} />
              <Area type="monotone" dataKey={dataKey} stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.18} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function StationChart({ title, data, dataKey, color, symbol }: { title: string; data: { name: string }[]; dataKey: string; color: string; symbol?: string }) {
  return (
    <div className="gz-panel p-4">
      <h2 className="mb-3 font-heading text-lg font-semibold">{title}</h2>
      <div className="h-72">
        {data.length === 0 ? <p className="flex h-full items-center text-muted-foreground">No played sessions in this range.</p> : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(value) => symbol ? `${symbol}${value}` : String(value)} />
              <YAxis type="category" dataKey="name" width={72} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip {...chartTooltip} />
              <Bar dataKey={dataKey} fill={color} radius={4} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function BarBlock({ title, data, dataKey, x, color }: { title: string; data: object[]; dataKey: string; x: string; color: string }) {
  return (
    <div className="gz-panel p-4">
      <h2 className="mb-3 font-heading text-lg font-semibold">{title}</h2>
      <div className="h-64">
        {data.length === 0 ? <p className="flex h-full items-center text-muted-foreground">No figures in this range yet.</p> : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey={x} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} width={36} axisLine={false} tickLine={false} />
              <Tooltip {...chartTooltip} />
              <Bar dataKey={dataKey} fill={color} radius={5} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function StationTable({ stations, symbol }: { stations: Report["stations"]; symbol: string }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="w-full text-left text-base">
        <thead className="bg-muted/50 text-sm text-muted-foreground">
          <tr>{["Station", "Type", "Bookings", "Hours", "Revenue", "Avg session", "Utilization"].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr>
        </thead>
        <tbody>
          {stations.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-muted-foreground">No played sessions in this range.</td></tr>}
          {stations.map((station) => (
            <tr key={station.stationId} className="border-t border-border">
              <td className="px-4 py-3 font-medium">{station.name}</td>
              <td className="px-4 py-3">{station.typeName}</td>
              <td className="px-4 py-3">{station.bookings}</td>
              <td className="px-4 py-3">{station.hours}</td>
              <td className="px-4 py-3">{money(station.revenue, symbol)}</td>
              <td className="px-4 py-3">{formatDuration(station.averageMinutes)}</td>
              <td className="px-4 py-3">{station.utilization}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
