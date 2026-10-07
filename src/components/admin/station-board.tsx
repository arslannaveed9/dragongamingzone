"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { formatClock, hoursTicks, positionOnGamingDay } from "@/lib/gaming-day";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Countdown } from "@/components/admin/countdown";
import { api, figure, formatDuration, money, notifyRefresh, openBooking, STATUS_LABEL, usePoll } from "@/components/admin/client";
import { EndSessionDialog } from "@/components/admin/end-session-dialog";
import { StatusPill } from "@/components/admin/status-pill";
import { DayTimeline } from "@/components/day-timeline";

type Block = {
  bookingId: string;
  bookingNumber?: string;
  customerName: string;
  status: string;
  startAt: string;
  endAt: string;
  controllerCount?: number;
};

type StationCard = {
  id: string;
  name: string;
  typeName: string;
  description: string;
  status: string;
  operationalStatus: string;
  maxControllers: number;
  pricing: { per30Min: number; perHour: number; additionalPerHour: number; current60: number };
  current: null | {
    bookingId: string;
    bookingNumber: string;
    customerName: string;
    controllerCount: number;
    startAt: string;
    endAt: string;
    finalAmount: number | null;
    amountPaid: number;
    paymentStatus: string;
    durationMinutes: number;
    paused: boolean;
    remainingMs: number;
  };
  next: null | {
    bookingId: string;
    customerName: string;
    startAt: string;
    endAt: string;
    durationMinutes: number;
    amountPaid: number;
    paymentStatus: string;
    finalAmount: number | null;
  };
  nextAvailableAt: string | null;
  timeline: Block[];
};

type Board = {
  serverNow: string;
  gamingDay: string;
  withinHours: boolean;
  closedGap: boolean;
  dayStart: string;
  dayEnd: string;
  settings: {
    system: { currencySymbol: string; timeFormat: "12h" | "24h"; dateFormat: string };
    operatingHours: { gamingDayStart: string; gamingDayEnd: string; timezone: string };
  };
  stations: StationCard[];
  counts: { total: number; playing: number; available: number; reserved: number };
};

export function StationBoard() {
  const [day, setDay] = useState("");
  const url = day ? `/api/live?gamingDay=${day}` : "/api/live";
  const { data, loading, error } = usePoll<Board>(url, 8000);
  const [extendId, setExtendId] = useState<string | null>(null);
  const [extendMinutes, setExtendMinutes] = useState(30);
  const [extendMax, setExtendMax] = useState(0);
  const [ending, setEnding] = useState<null | { id: string; name: string; paymentStatus: string; amountPaid: number; total: number | null }>(null);

  const hours = data?.settings.operatingHours;
  const symbol = data?.settings.system.currencySymbol || "Rs";
  const timeFormat = data?.settings.system.timeFormat || "12h";
  const ticks = useMemo(() => (hours ? hoursTicks(hours) : []), [hours]);

  function clock(iso: string) {
    if (!hours) return "";
    return formatClock(new Date(iso), hours.timezone, timeFormat);
  }

  async function prepareExtend(id: string) {
    try {
      const options = await api<{ maxMore: number; options: number[]; step: number }>(`/api/bookings/${id}/extend-options`);
      setExtendMax(options.maxMore);
      setExtendMinutes(options.options[0] || options.step);
      setExtendId(id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cannot extend this session.");
    }
  }

  async function extend() {
    if (!extendId) return;
    try {
      await api(`/api/bookings/${extendId}/actions`, { method: "POST", body: JSON.stringify({ type: "extend", minutes: extendMinutes }) });
      toast.success("Session extended.");
      setExtendId(null);
      notifyRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not extend.");
    }
  }

  async function endSession() {
    if (!ending) return;
    try {
      await api(`/api/bookings/${ending.id}/actions`, { method: "POST", body: JSON.stringify({ type: "end" }) });
      toast.success("Booking ended.");
      setEnding(null);
      notifyRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not end the booking.");
    }
  }

  async function startBooking(id: string, force: boolean) {
    try {
      await api(`/api/bookings/${id}/actions`, { method: "POST", body: JSON.stringify({ type: "start", force }) });
      toast.success(force ? "Started now. Booked time runs from this moment." : "Session started.");
      notifyRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start the booking.");
    }
  }

  function onTimelineClick(stationId: string, event: React.MouseEvent<HTMLDivElement>) {
    if (!data || !hours) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const instant = new Date(new Date(data.dayStart).getTime() + ratio * (new Date(data.dayEnd).getTime() - new Date(data.dayStart).getTime()));
    const step = 30;
    const local = new Date(instant);
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: hours.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(local);
    const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
    const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);
    const rounded = Math.floor((hour * 60 + minute) / step) * step;
    const hh = String(Math.floor(rounded / 60)).padStart(2, "0");
    const mm = String(rounded % 60).padStart(2, "0");
    openBooking({ mode: "reservation", stationId, gamingDay: data.gamingDay, startTime: `${hh}:${mm}` });
  }

  return (
    <Tabs defaultValue="floor">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-semibold">Floor</h2>
          <p className="text-sm text-muted-foreground">
            {data ? `Gaming day ${data.gamingDay}${data.closedGap ? " · closed until open" : ""}` : "Loading the floor"}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <input type="date" className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-2 text-sm sm:w-40 sm:flex-none" value={day || data?.gamingDay || ""} onChange={(event) => setDay(event.target.value)} />
          <TabsList className="h-10">
            <TabsTrigger value="floor">Grid</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>
        </div>
      </div>
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
      <TabsContent value="floor">
        {loading && !data ? <p className="text-sm text-muted-foreground">Loading stations...</p> : null}
        {data && data.stations.length === 0 && <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No stations yet. Add them on the Stations page.</p>}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data?.stations.map((station) => (
            <article key={station.id} className={`gz-panel p-4 ${station.status === "playing" ? "ring-1 ring-cyan-300/40" : station.status === "paused" ? "ring-1 ring-violet-300/40" : station.status === "available" ? "ring-1 ring-emerald-300/30" : station.status === "reserved" ? "ring-1 ring-amber-200/40" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-heading text-xl font-semibold">{station.name}</h2>
                  <p className="text-sm text-muted-foreground">{station.typeName}</p>
                </div>
                <StatusPill status={station.status} />
              </div>
              {station.current ? (
                <div className="mt-3 space-y-2 text-base">
                  <p className="font-medium">{station.current.customerName}</p>
                  <p className="text-sm text-muted-foreground">{station.current.controllerCount} controllers · {clock(station.current.startAt)} → {clock(station.current.endAt)}</p>
                  <p className="font-heading text-lg font-semibold">{formatDuration(station.current.durationMinutes)} booked</p>
                  {(station.status === "playing" || station.status === "paused") ? (
                    <Countdown endAt={station.current.endAt} paused={station.current.paused} remainingMs={station.current.remainingMs} serverNow={data.serverNow} />
                  ) : (
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-200">Held until you start it</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {STATUS_LABEL[station.current.paymentStatus] || station.current.paymentStatus}
                    {" · received "}
                    {money(station.current.amountPaid, symbol)}
                    {station.current.finalAmount != null ? ` of ${figure(station.current.finalAmount, symbol)}` : ""}
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">{station.status === "available" ? `Open · ${money(station.pricing.current60, symbol)} / hour` : station.status}</p>
              )}
              {station.next && (
                <div className="mt-3 rounded-lg bg-amber-400/10 px-3 py-2 text-sm">
                  <p className="font-medium">Upcoming · {station.next.customerName}</p>
                  <p className="text-muted-foreground">{formatDuration(station.next.durationMinutes)} · {clock(station.next.startAt)} · {STATUS_LABEL[station.next.paymentStatus] || station.next.paymentStatus} · received {money(station.next.amountPaid, symbol)}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => startBooking(station.next!.bookingId, true)}>Start early</Button>
                    <Button size="sm" variant="outline" onClick={() => setEnding({ id: station.next!.bookingId, name: station.next!.customerName, paymentStatus: station.next!.paymentStatus, amountPaid: station.next!.amountPaid, total: station.next!.finalAmount })}>End</Button>
                  </div>
                </div>
              )}
              {station.nextAvailableAt && station.current && new Date(station.nextAvailableAt).getTime() > Date.parse(data.serverNow) && <p className="text-xs text-muted-foreground">Available after {clock(station.nextAvailableAt)}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {station.status === "available" && station.operationalStatus === "active" && (
                  <Button size="sm" onClick={() => openBooking({ mode: "walk_in", stationId: station.id, gamingDay: data?.gamingDay })}>Walk-in</Button>
                )}
                {station.current && station.status === "reserved" && (
                  <Button size="sm" onClick={() => startBooking(station.current!.bookingId, new Date(station.current!.startAt).getTime() > Date.parse(data.serverNow))}>
                    {new Date(station.current.startAt).getTime() > Date.parse(data.serverNow) ? "Start early" : "Start"}
                  </Button>
                )}
                {station.current && (station.status === "playing" || station.status === "paused") && (
                  <Button size="sm" variant="outline" onClick={() => prepareExtend(station.current!.bookingId)}>Extend</Button>
                )}
                {station.current && (station.status === "playing" || station.status === "paused" || station.status === "reserved") && (
                  <Button size="sm" variant="outline" onClick={() => setEnding({
                    id: station.current!.bookingId,
                    name: station.current!.customerName,
                    paymentStatus: station.current!.paymentStatus,
                    amountPaid: station.current!.amountPaid,
                    total: station.current!.finalAmount,
                  })}>End</Button>
                )}
                {station.current && <Button size="sm" variant="outline" onClick={() => openBooking({ bookingId: station.current!.bookingId })}>Edit</Button>}
              </div>
            </article>
          ))}
        </div>
      </TabsContent>
      <TabsContent value="timeline">
        {data && hours && (
          <DayTimeline
            ticks={ticks}
            timeFormat={timeFormat}
            nowRatio={!day || day === data.gamingDay ? Math.min(1, Math.max(0, positionOnGamingDay(new Date(data.serverNow), data.gamingDay, hours))) : null}
            nowLabel={clock(data.serverNow)}
            onEmptyClick={onTimelineClick}
            onBlockClick={(id) => openBooking({ bookingId: id })}
            rows={data.stations.map((station) => ({
              id: station.id,
              name: station.name,
              blocks: station.timeline.map((block) => ({
                id: block.bookingId,
                status: block.status,
                label: block.customerName,
                start: Math.max(0, positionOnGamingDay(new Date(block.startAt), data.gamingDay, hours)),
                end: Math.min(1, positionOnGamingDay(new Date(block.endAt), data.gamingDay, hours)),
              })),
            }))}
          />
        )}
        <p className="mt-2 text-xs text-muted-foreground">Click an empty slot to start a booking. Click a block to edit it. Each mark is one hour, and the red line is the current time.</p>
      </TabsContent>
      <Dialog open={Boolean(extendId)} onOpenChange={(next) => !next && setExtendId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Extend session</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{extendMax > 0 ? `Up to ${formatDuration(extendMax)} can be added.` : "No free time remains after this session."}</p>
          <select className="h-9 rounded-lg border border-input bg-background px-2 text-sm" value={extendMinutes} onChange={(event) => setExtendMinutes(Number(event.target.value))}>
            {[30, 60, 90, 120].filter((value) => value <= extendMax).map((value) => <option key={value} value={value}>+{formatDuration(value)}</option>)}
            {extendMax > 0 && <option value={extendMax}>Until the next limit ({formatDuration(extendMax)})</option>}
          </select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendId(null)}>Cancel</Button>
            <Button onClick={extend} disabled={extendMax <= 0}>Extend</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <EndSessionDialog
        open={Boolean(ending)}
        onOpenChange={(next) => !next && setEnding(null)}
        customerName={ending?.name}
        paymentStatus={ending?.paymentStatus || "unpaid"}
        amountPaid={ending?.amountPaid || 0}
        total={ending?.total ?? null}
        symbol={symbol}
        onConfirm={() => void endSession()}
      />
    </Tabs>
  );
}
