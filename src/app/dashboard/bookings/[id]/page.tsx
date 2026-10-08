"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, endBookingWithPayment, formatDuration, money, notifyRefresh, openBooking, STATUS_LABEL, usePoll } from "@/components/admin/client";
import { EndSessionDialog } from "@/components/admin/end-session-dialog";
import { StatusPill } from "@/components/admin/status-pill";
import { formatClock } from "@/lib/gaming-day";

type Detail = {
  timezone: string;
  timeFormat: "12h" | "24h";
  currencySymbol: string;
  booking: {
    id: string;
    bookingNumber: string;
    customerName: string;
    customerPhone: string;
    stationName: string;
    stationTypeName: string;
    gamingDay: string;
    startAt: string;
    endAt: string;
    durationMinutes: number;
    controllerCount: number;
    status: string;
    paused: boolean;
    source: string;
    notes: string;
    paymentStatus: string;
    amountPaid: number;
    cancelReason: string;
    createdByName: string;
    createdAt: string;
    pricing: {
      baseAmount: number;
      controllerAmount: number;
      discountAmount: number;
      subtotal: number;
      finalAmount: number;
      currency: string;
      appliedDiscountName?: string;
      appliedRuleName?: string;
      breakdown?: {
        base?: { hours: number; remainderMinutes: number; amount: number };
        controllers?: { controllerNumber: number; amount: number }[];
      };
    };
  };
  payments: { id: string; amount: number; kind: string; method: string; recordedByName: string; createdAt: string }[];
  productOrders: { id: string; orderNumber: string; total: number; items: { name: string; quantity: number; lineTotal: number }[] }[];
  combinedTotal: number;
  history: { id: string; userName: string; action: string; createdAt: string }[];
};

export default function BookingDetailPage() {
  const params = useParams<{ id: string }>();
  const { data, reload, loading } = usePoll<Detail>(`/api/bookings/${params.id}`, 10000);
  const [ending, setEnding] = useState(false);
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const booking = data?.booking;

  async function act(body: object) {
    try {
      await api(`/api/bookings/${params.id}/actions`, { method: "POST", body: JSON.stringify(body) });
      toast.success("Updated.");
      notifyRefresh();
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the booking.");
    }
  }

  async function pay(kind: "payment" | "refund") {
    try {
      await api("/api/payments", { method: "POST", body: JSON.stringify({ bookingId: params.id, amount: Number(amount), method, kind }) });
      setAmount("");
      toast.success(kind === "refund" ? "Refund recorded." : "Payment recorded.");
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not record payment.");
    }
  }

  if (loading && !data) return <p className="text-sm text-muted-foreground">Loading booking...</p>;
  if (!booking || !data) return <p className="text-sm text-destructive">Booking not found.</p>;
  const symbol = data.currencySymbol;
  const clock = (iso: string) => formatClock(new Date(iso), data.timezone, data.timeFormat);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{booking.customerName}</h1>
          <p className="text-sm text-muted-foreground">{booking.stationName}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => openBooking({ bookingId: booking.id })}>Edit</Button>
          <StatusPill status={booking.status} />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
          <h2 className="mb-2 text-sm font-medium">Session</h2>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div><dt className="text-muted-foreground">Phone</dt><dd>{booking.customerPhone || "—"}</dd></div>
            <div><dt className="text-muted-foreground">Type</dt><dd>{booking.stationTypeName}</dd></div>
            <div><dt className="text-muted-foreground">Gaming day</dt><dd>{booking.gamingDay}</dd></div>
            <div><dt className="text-muted-foreground">When</dt><dd>{clock(booking.startAt)} → {clock(booking.endAt)}</dd></div>
            <div><dt className="text-muted-foreground">Booked time</dt><dd className="font-heading text-lg font-semibold">{formatDuration(booking.durationMinutes)}</dd></div>
            <div><dt className="text-muted-foreground">Controllers</dt><dd>{booking.controllerCount}</dd></div>
            <div><dt className="text-muted-foreground">Source</dt><dd className="capitalize">{booking.source.replace("_", " ")}</dd></div>
            <div><dt className="text-muted-foreground">Created by</dt><dd>{booking.createdByName}</dd></div>
          </dl>
          {booking.notes && <p className="mt-3 text-sm">Notes: {booking.notes}</p>}
          {booking.cancelReason && <p className="mt-2 text-sm">Cancelled: {booking.cancelReason}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            {booking.status === "scheduled" && new Date(booking.startAt).getTime() > Date.now() && <Button size="sm" onClick={() => act({ type: "start", force: true })}>Start early</Button>}
            {booking.status === "scheduled" && new Date(booking.startAt).getTime() <= Date.now() && <Button size="sm" onClick={() => act({ type: "start" })}>Start</Button>}
            {booking.status === "active" && !booking.paused && <Button size="sm" variant="outline" onClick={() => act({ type: "pause" })}>Pause</Button>}
            {booking.status === "active" && booking.paused && <Button size="sm" variant="outline" onClick={() => act({ type: "resume", preserveTime: true })}>Resume</Button>}
            {(booking.status === "active" || booking.status === "scheduled") && <Button size="sm" onClick={() => setEnding(true)}>End</Button>}
            {booking.status === "scheduled" && <Button size="sm" variant="outline" onClick={() => act({ type: "no_show" })}>No-show</Button>}
          </div>
          {(booking.status === "scheduled" || booking.status === "active") && (
            <div className="mt-3 flex gap-2">
              <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Cancellation reason" />
              <Button variant="destructive" onClick={() => act({ type: "cancel", reason })}>Cancel</Button>
            </div>
          )}
        </section>
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-2 text-sm font-medium">Pricing</h2>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span>Base</span><span>{money(booking.pricing.baseAmount, symbol)}</span></div>
            <div className="flex justify-between"><span>Controllers</span><span>{money(booking.pricing.controllerAmount, symbol)}</span></div>
            <div className="flex justify-between"><span>Discount {booking.pricing.appliedDiscountName}</span><span>-{money(booking.pricing.discountAmount, symbol)}</span></div>
            <div className="flex justify-between font-semibold"><span>Gaming total</span><span>{money(booking.pricing.finalAmount, symbol)}</span></div>
            {booking.pricing.appliedRuleName && <p className="text-xs text-muted-foreground">Rate: {booking.pricing.appliedRuleName}</p>}
            {data.productOrders.map((order) => (
              <div key={order.id} className="border-t border-border pt-2">
                <p className="text-xs text-muted-foreground">{order.orderNumber}</p>
                {order.items.map((item) => <div key={item.name} className="flex justify-between"><span>{item.quantity} × {item.name}</span><span>{money(item.lineTotal, symbol)}</span></div>)}
              </div>
            ))}
            <div className="flex justify-between border-t border-border pt-2 font-semibold"><span>Combined</span><span>{money(data.combinedTotal, symbol)}</span></div>
          </div>
          <div className="mt-3 space-y-1 text-base">
            <p className="flex items-center gap-2">Payment <StatusPill status={booking.paymentStatus} /></p>
            <p>Received <strong>{money(booking.amountPaid, symbol)}</strong> of {money(booking.pricing.finalAmount, symbol)}</p>
            {booking.amountPaid + 0.009 < booking.pricing.finalAmount && (
              <p className="font-heading text-lg font-bold text-rose-700 dark:text-rose-200">Balance {money(Math.max(0, booking.pricing.finalAmount - booking.amountPaid), symbol)}</p>
            )}
          </div>
          <div className="mt-2 grid gap-2">
            <select className="h-9 rounded-lg border border-input bg-background px-2 text-sm" value={method} onChange={(event) => setMethod(event.target.value)}>
              {["cash", "card", "bank_transfer", "easypaisa", "jazzcash", "other"].map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <Input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Amount" />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => pay("payment")}>Record payment</Button>
              <Button size="sm" variant="outline" onClick={() => pay("refund")}>Refund</Button>
            </div>
          </div>
        </section>
      </div>
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-2 text-sm font-medium">History</h2>
        {data.history.length === 0 && <p className="text-sm text-muted-foreground">No audit entries yet.</p>}
        {data.history.map((item) => (
          <div key={item.id} className="flex justify-between border-b border-border py-2 text-sm last:border-0">
            <span>{item.action} · {item.userName}</span>
            <span className="text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</span>
          </div>
        ))}
        {data.payments.length > 0 && <h3 className="mt-4 text-sm font-medium">Payments</h3>}
        {data.payments.map((payment) => (
          <div key={payment.id} className="flex justify-between py-1 text-sm">
            <span className="capitalize">{payment.kind} · {payment.method} · {payment.recordedByName}</span>
            <span>{money(payment.amount, symbol)}</span>
          </div>
        ))}
      </section>
      {ending ? (
        <EndSessionDialog
          open
          onOpenChange={setEnding}
          customerName={booking.customerName}
          paymentStatus={booking.paymentStatus}
          amountPaid={booking.amountPaid}
          total={booking.pricing.finalAmount}
          symbol={symbol}
          onConfirm={(payment) => {
            setEnding(false);
            void endBookingWithPayment(booking.id, payment)
              .then(() => {
                toast.success(payment ? "Booking ended and marked paid." : "Updated.");
                notifyRefresh();
                return reload();
              })
              .catch((error) => toast.error(error instanceof Error ? error.message : "Could not update the booking."));
          }}
        />
      ) : null}
    </div>
  );
}
