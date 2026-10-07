"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDuration, money, openBooking, STATUS_LABEL, usePoll } from "@/components/admin/client";
import { StatusPill } from "@/components/admin/status-pill";
import { formatClock } from "@/lib/gaming-day";
import { displayBookingNumber } from "@/lib/text";

type Row = {
  id: string;
  bookingNumber: string;
  customerName: string;
  stationName: string;
  stationTypeName: string;
  gamingDay: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  controllerCount: number;
  pricing: { baseAmount: number; discountAmount: number; finalAmount: number };
  paymentStatus: string;
  amountPaid: number;
  status: string;
  createdByName: string;
  createdAt: string;
};

export default function BookingsPage() {
  const [gamingDay, setGamingDay] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page), pageSize: "25" });
  if (gamingDay) params.set("gamingDay", gamingDay);
  if (status) params.set("status", status);
  if (q) params.set("q", q);
  const { data, loading } = usePoll<{ items: Row[]; total: number; page: number; pageSize: number; timezone: string; timeFormat: "12h" | "24h"; currencySymbol: string }>(`/api/bookings?${params.toString()}`, 15000);
  const timezone = data?.timezone || "Asia/Karachi";
  const timeFormat = data?.timeFormat || "12h";
  const symbol = data?.currencySymbol || "Rs";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Bookings</h1>
          <p className="text-sm text-muted-foreground">{data ? `${data.total} records` : "History"}</p>
        </div>
        <Button onClick={() => openBooking({ mode: "reservation" })}>New booking</Button>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
        <Input className="w-full sm:max-w-xs" placeholder="Name, phone, booking ID" value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} />
        <Input type="date" className="w-full sm:w-40" value={gamingDay} onChange={(event) => { setGamingDay(event.target.value); setPage(1); }} />
        <select className="h-10 w-full rounded-lg border border-input bg-background px-2 text-sm sm:w-auto" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {["scheduled", "active", "completed", "cancelled", "no_show"].map((item) => <option key={item} value={item}>{STATUS_LABEL[item]}</option>)}
        </select>
        <Button variant="outline" onClick={() => { setGamingDay(""); setStatus(""); setQ(""); }}>Clear</Button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              {["Booking", "Customer", "Station", "Gaming day", "Start", "End", "Booked", "Controllers", "Total", "Received", "Payment", "Status", "By"].map((heading) => (
                <th key={heading} className="px-3 py-2 font-medium">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && !data && <tr><td className="px-3 py-6 text-muted-foreground" colSpan={13}>Loading bookings...</td></tr>}
            {data?.items.length === 0 && <tr><td className="px-3 py-6 text-muted-foreground" colSpan={13}>No bookings match these filters.</td></tr>}
            {data?.items.map((row) => (
              <tr key={row.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-3 py-2">
                  <Link className="font-medium text-primary underline-offset-2 hover:underline" href={`/dashboard/bookings/${row.id}`}>{displayBookingNumber(row.bookingNumber)}</Link>
                  <button type="button" className="ml-2 text-xs font-medium text-primary" onClick={() => openBooking({ bookingId: row.id })}>Edit</button>
                </td>
                <td className="px-3 py-2">{row.customerName}</td>
                <td className="px-3 py-2">{row.stationName}<div className="text-xs text-muted-foreground">{row.stationTypeName}</div></td>
                <td className="px-3 py-2">{row.gamingDay}</td>
                <td className="px-3 py-2">{formatClock(new Date(row.startAt), timezone, timeFormat)}</td>
                <td className="px-3 py-2">{formatClock(new Date(row.endAt), timezone, timeFormat)}</td>
                <td className="px-3 py-2">{formatDuration(row.durationMinutes)}</td>
                <td className="px-3 py-2">{row.controllerCount}</td>
                <td className="px-3 py-2">{money(row.pricing.finalAmount, symbol)}</td>
                <td className="px-3 py-2">{money(row.amountPaid, symbol)}</td>
                <td className="px-3 py-2"><StatusPill status={row.paymentStatus} /></td>
                <td className="px-3 py-2"><StatusPill status={row.status} /></td>
                <td className="px-3 py-2">{row.createdByName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data && data.total > data.pageSize && (
        <div className="flex gap-2">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
          <Button variant="outline" disabled={page * data.pageSize >= data.total} onClick={() => setPage((value) => value + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}
