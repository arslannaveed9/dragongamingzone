"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { toast } from "sonner";
import { GripHorizontal, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, formatDuration, money, notifyRefresh, STATUS_LABEL } from "@/components/admin/client";

type Catalog = {
  stations: {
    id: string;
    name: string;
    typeName: string;
    operationalStatus: string;
    maxControllers: number;
  }[];
  booking: { minDurationMinutes: number; maxDurationMinutes: number; durationStepMinutes: number };
  system: { currencySymbol: string; timeFormat: "12h" | "24h" };
  operatingHours: { timezone: string; gamingDayStart: string; gamingDayEnd: string };
};

type Quote = {
  finalAmount: number;
  baseAmount: number;
  controllerAmount: number;
  discountAmount: number;
  subtotal: number;
  appliedDiscount: { name: string } | null;
  currencySymbol: string;
  gamingDay: string;
  startAt: string;
  endAt: string;
};

type CustomerHit = { id: string; name: string; phone: string };

const METHODS = [
  ["cash", "Cash"],
  ["card", "Card"],
  ["bank_transfer", "Bank transfer"],
  ["easypaisa", "EasyPaisa"],
  ["jazzcash", "JazzCash"],
  ["other", "Other"],
] as const;

function clamp(value: number, min: number, max: number) {
  const lower = Math.min(min, max);
  const upper = Math.max(min, max);
  return Math.min(upper, Math.max(lower, value));
}

function placeDrag(x: number, y: number, panel: HTMLElement | null, applied: { x: number; y: number }) {
  if (!panel) return { x, y };
  const rect = panel.getBoundingClientRect();
  const viewport = window.visualViewport;
  const viewLeft = viewport?.offsetLeft ?? 0;
  const viewTop = viewport?.offsetTop ?? 0;
  const viewRight = viewLeft + (viewport?.width ?? window.innerWidth);
  const viewBottom = viewTop + (viewport?.height ?? window.innerHeight);
  const margin = 48;
  const baseLeft = rect.left - applied.x;
  const baseTop = rect.top - applied.y;
  const left = clamp(baseLeft + x, viewLeft + margin - rect.width, viewRight - margin);
  const top = clamp(baseTop + y, viewTop + margin - rect.height, viewBottom - margin);
  return { x: left - baseLeft, y: top - baseTop };
}

function clockHm(iso: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const hour = parts.find((part) => part.type === "hour")?.value || "00";
  const minute = parts.find((part) => part.type === "minute")?.value || "00";
  return `${hour}:${minute}`;
}

export function BookingDialog({
  open,
  onOpenChange,
  preset,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preset?: { mode?: "walk_in" | "reservation"; stationId?: string; gamingDay?: string; startTime?: string; bookingId?: string };
}) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [mode, setMode] = useState<"walk_in" | "reservation">("walk_in");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [hits, setHits] = useState<CustomerHit[]>([]);
  const [lookup, setLookup] = useState(false);
  const [stationId, setStationId] = useState("");
  const [controllers, setControllers] = useState(1);
  const [gamingDay, setGamingDay] = useState("");
  const [startTime, setStartTime] = useState("");
  const [customTime, setCustomTime] = useState(false);
  const [duration, setDuration] = useState(60);
  const [notes, setNotes] = useState("");
  const [takePayment, setTakePayment] = useState(false);
  const [method, setMethod] = useState("cash");
  const [paid, setPaid] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [amountPaid, setAmountPaid] = useState(0);
  const [bill, setBill] = useState<number | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(offset);
  const dragRef = useRef<{ id: number; x: number; y: number; ox: number; oy: number } | null>(null);
  const draggedRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect -- the dialog is reused and must adopt the preset that opened it */
    setHits([]);
    setLookup(false);
    setQuote(null);
    setOffset({ x: 0, y: 0 });
    offsetRef.current = { x: 0, y: 0 };
    draggedRef.current = false;
    const bookingId = preset?.bookingId;
    if (bookingId) {
      setTakePayment(false);
      setPaid("");
    }
    if (!bookingId) {
      setEditingId(null);
      setMode(preset?.mode || "walk_in");
      setStationId(preset?.stationId || "");
      setGamingDay(preset?.gamingDay || "");
      setStartTime(preset?.startTime || "");
      setCustomTime(Boolean(preset?.startTime) || preset?.mode === "reservation");
      setControllers(1);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerId(null);
      setNotes("");
      setTakePayment(false);
      setMethod("cash");
      setPaid("");
      setPaymentStatus("");
      setAmountPaid(0);
      setBill(null);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    api<Catalog>("/api/stations")
      .then(async (data) => {
        if (cancelled) return;
        setCatalog(data);
        if (!bookingId) {
          setDuration(data.booking.minDurationMinutes <= 60 ? 60 : data.booking.minDurationMinutes);
          if (!preset?.stationId) {
            const first = data.stations.find((station) => station.operationalStatus === "active");
            if (first) setStationId(first.id);
          }
          return;
        }
        const detail = await api<{
          timezone: string;
          booking: {
            id: string;
            bookingNumber: string;
            customerName: string;
            customerPhone: string;
            stationId: string;
            gamingDay: string;
            startAt: string;
            durationMinutes: number;
            controllerCount: number;
            notes: string;
            source: string;
            paymentStatus: string;
            amountPaid: number;
            pricing: { finalAmount: number };
          };
        }>(`/api/bookings/${bookingId}`);
        if (cancelled) return;
        const booking = detail.booking;
        const received = booking.amountPaid || 0;
        const total = booking.pricing?.finalAmount ?? 0;
        setEditingId(booking.id);
        setMode(booking.source === "reservation" ? "reservation" : "walk_in");
        setCustomTime(true);
        setLookup(false);
        setHits([]);
        setCustomerName(booking.customerName);
        setCustomerPhone(booking.customerPhone || "");
        setCustomerId(null);
        setStationId(booking.stationId);
        setControllers(booking.controllerCount);
        setGamingDay(booking.gamingDay);
        setStartTime(clockHm(booking.startAt, detail.timezone));
        setDuration(booking.durationMinutes);
        setNotes(booking.notes || "");
        setPaymentStatus(booking.paymentStatus || "unpaid");
        setAmountPaid(received);
        setBill(total);
        setMethod("cash");
        setTakePayment(false);
        setPaid("");
      })
      .catch((error) => toast.error(error.message));
    return () => {
      cancelled = true;
    };
  }, [open, preset]);

  const station = catalog?.stations.find((item) => item.id === stationId);
  const durations = useMemo(() => {
    if (!catalog) return [duration];
    const values: number[] = [];
    for (let value = catalog.booking.minDurationMinutes; value <= catalog.booking.maxDurationMinutes; value += catalog.booking.durationStepMinutes) {
      values.push(value);
    }
    if (duration && !values.includes(duration)) values.push(duration);
    return values.sort((a, b) => a - b);
  }, [catalog, duration]);

  useEffect(() => {
    if (!open || !lookup || customerName.trim().length < 2) {
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      api<CustomerHit[]>(`/api/customers?suggest=1&q=${encodeURIComponent(customerName.trim())}`)
        .then((rows) => {
          if (!cancelled) setHits(rows);
        })
        .catch(() => {
          if (!cancelled) setHits([]);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [customerName, lookup, open]);

  useEffect(() => {
    if (!open || !stationId || !catalog) return;
    const timer = setTimeout(() => {
      api<Quote>("/api/bookings/quote", {
        method: "POST",
        body: JSON.stringify({
          mode,
          stationId,
          controllerCount: controllers,
          durationMinutes: duration,
          ...(mode === "reservation" || customTime ? { gamingDay, startTime } : {}),
        }),
      })
        .then((next) => {
          setQuote(next);
          if (preset?.bookingId) return;
          setPaid((current) => current || String(next.finalAmount));
        })
        .catch(() => setQuote(null));
    }, 250);
    return () => clearTimeout(timer);
  }, [open, mode, stationId, controllers, duration, gamingDay, startTime, customTime, catalog, preset?.bookingId]);

  async function save() {
    setSaving(true);
    try {
      if (editingId) {
        const updated = await api<{ pricing: { finalAmount: number }; amountPaid: number }>(`/api/bookings/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify({
            customerName,
            customerPhone,
            stationId,
            controllerCount: controllers,
            durationMinutes: duration,
            notes,
            gamingDay,
            startTime,
          }),
        });
        if (takePayment) {
          const wanted = Number(paid || 0);
          const due = Math.max(0, Math.round((updated.pricing.finalAmount - (updated.amountPaid || 0)) * 100) / 100);
          const amount = Math.min(wanted, due);
          if (amount > 0) {
            await api("/api/payments", {
              method: "POST",
              body: JSON.stringify({ bookingId: editingId, amount, method, kind: "payment" }),
            });
          }
        }
        toast.success("Booking updated.");
      } else {
        await api("/api/bookings", {
          method: "POST",
          body: JSON.stringify({
            mode,
            customerName,
            customerPhone,
            customerId,
            stationId,
            controllerCount: controllers,
            durationMinutes: duration,
            notes,
            ...(mode === "reservation" || customTime ? { gamingDay, startTime } : {}),
            payment: takePayment
              ? { amount: Number(paid || 0), method, reference: "" }
              : null,
          }),
        });
        toast.success(mode === "walk_in" && !customTime ? "Session started." : "Booking saved.");
      }
      notifyRefresh();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the booking.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    let observer: ResizeObserver | null = null;
    const frame = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const fit = () => {
        if (draggedRef.current) return;
        const current = panelRef.current;
        if (!current) return;
        const rect = current.getBoundingClientRect();
        const viewport = window.visualViewport;
        const viewTop = viewport?.offsetTop ?? 0;
        const viewBottom = viewTop + (viewport?.height ?? window.innerHeight);
        const margin = 8;
        let y = 0;
        if (rect.height >= viewBottom - viewTop - margin * 2) y = viewTop + margin - rect.top;
        else if (rect.top < viewTop + margin) y = viewTop + margin - rect.top;
        else if (rect.bottom > viewBottom - margin) y = viewBottom - margin - rect.bottom;
        if (Math.abs(y) < 1) return;
        const next = { x: offsetRef.current.x, y: offsetRef.current.y + y };
        offsetRef.current = next;
        setOffset(next);
      };
      observer = new ResizeObserver(fit);
      observer.observe(panel);
      fit();
    }, 150);
    return () => {
      window.clearTimeout(frame);
      observer?.disconnect();
    };
  }, [open]);

  function startDrag(event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("button, a, input, select, textarea")) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      ox: offsetRef.current.x,
      oy: offsetRef.current.y,
    };
  }

  function moveDrag(event: ReactPointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    const next = placeDrag(
      drag.ox + event.clientX - drag.x,
      drag.oy + event.clientY - drag.y,
      panelRef.current,
      offsetRef.current,
    );
    draggedRef.current = true;
    offsetRef.current = next;
    setOffset(next);
  }

  function endDrag(event: ReactPointerEvent<HTMLElement>) {
    if (dragRef.current?.id !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  const symbol = catalog?.system.currencySymbol || "Rs";
  const dragHandle = {
    onPointerDown: startDrag,
    onPointerMove: moveDrag,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={panelRef}
        className="flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-[calc(100%-1rem)] flex-col gap-3 overflow-hidden sm:max-w-lg"
        style={{ transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))` }}
      >
        <DialogHeader className="shrink-0 cursor-grab touch-none pr-8 select-none active:cursor-grabbing" {...dragHandle}>
          <DialogTitle className="flex items-center gap-2">
            <GripHorizontal className="size-4 shrink-0 text-muted-foreground" />
            {editingId ? `Edit ${customerName}` : mode === "walk_in" ? "New walk-in" : "New booking"}
          </DialogTitle>
        </DialogHeader>
        <div
          className="grid min-h-0 flex-1 gap-3 overflow-y-auto overscroll-contain"
          onMouseDown={(event) => {
            const target = event.target as HTMLElement;
            if (target.closest("[data-customer-field]") || target.closest("[data-name-suggest]")) return;
            setLookup(false);
            setHits([]);
          }}
        >
          {!editingId && (
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={mode === "walk_in" ? "default" : "outline"} onClick={() => { setMode("walk_in"); setCustomTime(false); }}>Walk-in</Button>
              <Button type="button" variant={mode === "reservation" ? "default" : "outline"} onClick={() => { setMode("reservation"); setCustomTime(true); }}>Reservation</Button>
            </div>
          )}
          <div className="relative grid grid-cols-2 gap-3">
            <div data-customer-field>
              <Label>Name</Label>
              <Input
                value={customerName}
                placeholder="Customer"
                onChange={(event) => {
                  const value = event.target.value;
                  setCustomerName(value);
                  setCustomerId(null);
                  setLookup(true);
                  if (value.trim().length < 2) setHits([]);
                }}
                onBlur={() => {
                  setLookup(false);
                  setHits([]);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setHits([]);
                }}
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="Optional" />
            </div>
            {lookup && hits.length > 0 && (
              <div data-name-suggest className="absolute top-full z-30 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-border bg-popover p-1 text-sm shadow-md">
                {hits.map((hit) => (
                  <button
                    key={hit.id}
                    type="button"
                    className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setCustomerId(hit.id);
                      setCustomerName(hit.name);
                      setCustomerPhone(hit.phone);
                      setLookup(false);
                      setHits([]);
                    }}
                  >
                    {hit.name} <span className="text-muted-foreground">{hit.phone}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Station</Label>
              <select className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-2 text-base" value={stationId} onChange={(event) => {
                const nextId = event.target.value;
                setStationId(nextId);
                const next = catalog?.stations.find((item) => item.id === nextId);
                setControllers((count) => Math.min(count, next?.maxControllers || 4));
              }}>
                {catalog?.stations.filter((item) => item.operationalStatus !== "archived").map((item) => (
                  <option key={item.id} value={item.id}>{item.name} · {item.typeName}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Duration</Label>
              <select className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-2 text-base" value={duration} onChange={(event) => setDuration(Number(event.target.value))}>
                {durations.map((value) => (
                  <option key={value} value={value}>{formatDuration(value)}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Controllers</span>
            <div className="flex h-10 items-center gap-1">
              <Button type="button" variant="outline" size="icon" aria-label="Fewer controllers" disabled={controllers <= 1} onClick={() => setControllers((count) => Math.max(1, count - 1))}>
                <Minus />
              </Button>
              <span className="w-8 text-center text-base font-semibold tabular-nums">{controllers}</span>
              <Button type="button" variant="outline" size="icon" aria-label="More controllers" disabled={controllers >= (station?.maxControllers || 4)} onClick={() => setControllers((count) => Math.min(station?.maxControllers || 4, count + 1))}>
                <Plus />
              </Button>
            </div>
          </div>
          {mode === "walk_in" && !editingId && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={customTime} onChange={(event) => setCustomTime(event.target.checked)} />
              Set a different start time
            </label>
          )}
          {(mode === "reservation" || customTime) && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Gaming day</Label>
                <Input type="date" value={gamingDay} onChange={(event) => setGamingDay(event.target.value)} />
              </div>
              <div>
                <Label>Start</Label>
                <Input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
              </div>
            </div>
          )}
          {quote && (
            <div className="flex flex-col gap-1 rounded-lg bg-muted/60 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {formatDuration(duration)}
                {quote.controllerAmount > 0 ? ` · ${Math.max(1, controllers - 1)} controller${controllers > 2 ? "s" : ""} ${money(quote.controllerAmount, symbol)}` : ""}
                {quote.discountAmount > 0 ? ` · ${quote.appliedDiscount?.name || "discount"} −${money(quote.discountAmount, symbol)}` : ""}
              </p>
              <p className="font-heading text-xl font-bold tabular-nums">{money(quote.finalAmount, symbol)}</p>
            </div>
          )}
          {editingId ? (
            <p className="text-sm text-muted-foreground">
              Payment status: <strong className="text-foreground">{STATUS_LABEL[paymentStatus] || paymentStatus || "Unpaid"}</strong>
              {bill != null ? ` · received ${money(amountPaid, symbol)} of ${money(bill, symbol)}` : ""}
            </p>
          ) : null}
          <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[auto_1fr_7.5rem]">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={takePayment} onChange={(event) => setTakePayment(event.target.checked)} />
              {editingId ? "Mark as paid" : "Paid"}
            </label>
            <select className="h-10 rounded-lg border border-input bg-background px-2 text-base disabled:opacity-50" value={method} disabled={!takePayment} onChange={(event) => setMethod(event.target.value)}>
              {METHODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <Input value={paid} onChange={(event) => setPaid(event.target.value)} inputMode="decimal" disabled={!takePayment} aria-label="Amount received" />
          </div>
        </div>
        <DialogFooter className="shrink-0 cursor-grab touch-none active:cursor-grabbing" {...dragHandle}>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !customerName.trim() || !stationId}>{saving ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
