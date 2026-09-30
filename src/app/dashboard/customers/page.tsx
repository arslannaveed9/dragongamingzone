"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, formatDuration, money, usePoll } from "@/components/admin/client";

type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string;
  stats: { totalBookings: number; totalMinutes: number; totalSpent: number };
};

export default function CustomersPage() {
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const { data, reload } = usePoll<{ items: Customer[]; total: number }>(`/api/customers?q=${encodeURIComponent(q)}&page=1&pageSize=50`);

  async function create() {
    try {
      await api("/api/customers", { method: "POST", body: JSON.stringify({ name, phone, email: "", notes: "" }) });
      setName("");
      setPhone("");
      toast.success("Customer added.");
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add the customer.");
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Customers</h1>
      <div className="flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="Search name or phone" value={q} onChange={(event) => setQ(event.target.value)} />
        <Input placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} />
        <Input placeholder="Phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
        <Button onClick={create}>Add customer</Button>
      </div>
      <div className="overflow-hidden rounded-xl border border-border">
        {data?.items.length === 0 && <p className="p-6 text-sm text-muted-foreground">No customers yet. They are also created when you save a booking.</p>}
        {data?.items.map((customer) => (
          <a key={customer.id} href={`/dashboard/customers/${customer.id}`} className="flex items-center justify-between border-b border-border px-4 py-3 text-sm last:border-0 hover:bg-muted/40">
            <span>{customer.name}<span className="ml-2 text-muted-foreground">{customer.phone}</span></span>
            <span className="text-muted-foreground">{customer.stats.totalBookings} bookings · {formatDuration(customer.stats.totalMinutes)} · {money(customer.stats.totalSpent)}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
