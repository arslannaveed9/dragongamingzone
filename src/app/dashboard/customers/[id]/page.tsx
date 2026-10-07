"use client";

import { useParams } from "next/navigation";
import { formatDuration, money, STATUS_LABEL, usePoll } from "@/components/admin/client";

type Payload = {
  customer: { name: string; phone: string; email: string; notes: string; stats: { totalBookings: number; totalMinutes: number; totalSpent: number; firstVisitAt: string | null; lastVisitAt: string | null } };
  bookings: { id: string; bookingNumber: string; stationName: string; gamingDay: string; status: string; durationMinutes: number; finalAmount: number }[];
};

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const { data, loading } = usePoll<Payload>(`/api/customers/${params.id}`);
  if (loading && !data) return <p className="text-sm text-muted-foreground">Loading customer...</p>;
  if (!data) return <p className="text-sm text-destructive">Customer not found.</p>;
  const customer = data.customer;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{customer.name}</h1>
        <p className="text-sm text-muted-foreground">{customer.phone || "No phone"} {customer.email}</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-3"><p className="text-xs text-muted-foreground">Bookings</p><p className="text-lg font-semibold">{customer.stats.totalBookings}</p></div>
        <div className="rounded-xl border border-border bg-card p-3"><p className="text-xs text-muted-foreground">Play time</p><p className="text-lg font-semibold">{formatDuration(customer.stats.totalMinutes)}</p></div>
        <div className="rounded-xl border border-border bg-card p-3"><p className="text-xs text-muted-foreground">Spending</p><p className="text-lg font-semibold">{money(customer.stats.totalSpent)}</p></div>
      </div>
      {customer.notes && <p className="text-sm">{customer.notes}</p>}
      <div className="rounded-xl border border-border">
        {data.bookings.length === 0 && <p className="p-4 text-sm text-muted-foreground">No bookings yet.</p>}
        {data.bookings.map((booking) => (
          <a key={booking.id} href={`/dashboard/bookings/${booking.id}`} className="flex justify-between border-b border-border px-4 py-3 text-sm last:border-0">
            <span>{booking.bookingNumber} · {booking.stationName} · {booking.gamingDay}</span>
            <span>{STATUS_LABEL[booking.status]} · {money(booking.finalAmount)}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
