"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, money, usePoll } from "@/components/admin/client";
import { DayPicker, daySummary, timeSummary } from "@/components/admin/schedule-fields";

type Discount = {
  id: string;
  name: string;
  type: "percentage" | "fixed";
  value: number;
  active: boolean;
  startTime: string | null;
  endTime: string | null;
  daysOfWeek: number[];
  stationIds: string[];
  minDurationMinutes: number | null;
  priority: number;
};

type Station = { id: string; name: string; operationalStatus: string };
type Catalog = { stations: Station[]; system?: { currencySymbol?: string } };

type Draft = {
  id: string | null;
  name: string;
  type: "percentage" | "fixed";
  value: string;
  limitedHours: boolean;
  startTime: string;
  endTime: string;
  days: number[];
  stationIds: string[];
  minDuration: string;
  priority: number;
  active: boolean;
};

const BLANK: Draft = {
  id: null,
  name: "",
  type: "percentage",
  value: "",
  limitedHours: false,
  startTime: "14:00",
  endTime: "18:00",
  days: [],
  stationIds: [],
  minDuration: "",
  priority: 0,
  active: true,
};

export default function DiscountsPage() {
  const { data, reload } = usePoll<Discount[]>("/api/discounts");
  const { data: catalog } = usePoll<Catalog>("/api/stations");
  const [form, setForm] = useState<Draft>(BLANK);
  const symbol = catalog?.system?.currencySymbol || "Rs";
  const stations = (catalog?.stations || []).filter((station) => station.operationalStatus !== "archived");
  const stationName = new Map(stations.map((station) => [station.id, station.name]));

  function edit(discount: Discount) {
    setForm({
      id: discount.id,
      name: discount.name,
      type: discount.type,
      value: String(discount.value),
      limitedHours: Boolean(discount.startTime && discount.endTime),
      startTime: discount.startTime || "14:00",
      endTime: discount.endTime || "18:00",
      days: discount.daysOfWeek,
      stationIds: discount.stationIds,
      minDuration: discount.minDurationMinutes == null ? "" : String(discount.minDurationMinutes),
      priority: discount.priority,
      active: discount.active,
    });
  }

  async function save() {
    const value = Number(form.value);
    if (!form.name.trim()) {
      toast.error("Give the discount a name, such as Afternoon.");
      return;
    }
    if (!Number.isFinite(value) || value <= 0 || (form.type === "percentage" && value > 100)) {
      toast.error(form.type === "percentage" ? "Enter a percent from 1 to 100." : "Enter an amount greater than zero.");
      return;
    }
    if (form.limitedHours && (!form.startTime || !form.endTime)) {
      toast.error("Set both a start time and an end time, or leave it as all day.");
      return;
    }
    const minDurationMinutes = form.minDuration.trim() === "" ? null : Number(form.minDuration);
    if (minDurationMinutes != null && (!Number.isInteger(minDurationMinutes) || minDurationMinutes < 0)) {
      toast.error("Minimum length must be a whole number of minutes, or left empty.");
      return;
    }
    try {
      await api(form.id ? `/api/discounts/${form.id}` : "/api/discounts", {
        method: form.id ? "PATCH" : "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          type: form.type,
          value,
          startTime: form.limitedHours ? form.startTime : null,
          endTime: form.limitedHours ? form.endTime : null,
          daysOfWeek: form.days,
          stationIds: form.stationIds,
          stationTypeIds: [],
          minDurationMinutes,
          priority: form.priority,
          active: form.active,
        }),
      });
      toast.success(form.id ? "Discount updated." : "Discount saved. It comes off automatically when a booking starts in this window.");
      setForm(BLANK);
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the discount.");
    }
  }

  async function disable(id: string) {
    await api(`/api/discounts/${id}`, { method: "DELETE" });
    if (form.id === id) setForm(BLANK);
    await reload();
  }

  function amountLabel(discount: Pick<Discount, "type" | "value">) {
    return discount.type === "percentage" ? `${discount.value}% off` : `${money(discount.value, symbol)} off`;
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="gz-kicker text-cyan-800 dark:text-cyan-200">Offers</p>
        <h1 className="gz-title">Discounts</h1>
        <p className="mt-2 max-w-3xl text-base text-muted-foreground">
          A discount is taken off the booking total by itself when the booking starts on the days and times you set. You do not pick it on the booking form. If more than one discount matches, the customer gets the larger saving.
        </p>
      </div>

      <section className="gz-panel space-y-4 p-4">
        <div>
          <h2 className="font-heading text-lg font-semibold">{form.id ? "Edit discount" : "Add a discount"}</h2>
          <p className="text-sm text-muted-foreground">Example: Afternoon, 20% off, Monday to Thursday, 2:00 PM–6:00 PM.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5 md:col-span-3">
            <Label htmlFor="discount-name">Name</Label>
            <Input id="discount-name" value={form.name} placeholder="Afternoon" onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="discount-type">Kind</Label>
            <select id="discount-type" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-base" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as Draft["type"] })}>
              <option value="percentage">Percent off the total</option>
              <option value="fixed">Fixed amount off the total</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="discount-value">{form.type === "percentage" ? "Percent off" : "Amount off"}</Label>
            <Input id="discount-value" type="number" min={0} max={form.type === "percentage" ? 100 : undefined} value={form.value} placeholder={form.type === "percentage" ? "20" : "100"} onChange={(event) => setForm({ ...form, value: event.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="discount-min">Minimum booking length</Label>
            <Input id="discount-min" type="number" min={0} value={form.minDuration} placeholder="Any length" onChange={(event) => setForm({ ...form, minDuration: event.target.value })} />
            <p className="text-sm text-muted-foreground">Minutes. Leave empty to allow any booking.</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Which days</Label>
          <DayPicker value={form.days} onChange={(days) => setForm({ ...form, days })} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.limitedHours} onChange={(event) => setForm({ ...form, limitedHours: event.target.checked })} />
          Only during certain hours
        </label>
        {form.limitedHours && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="discount-from">From</Label>
              <Input id="discount-from" type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="discount-until">Until</Label>
              <Input id="discount-until" type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} />
              <p className="text-sm text-muted-foreground">The end can be after midnight. The booking’s start time is what counts.</p>
            </div>
          </div>
        )}
        <div className="space-y-2">
          <Label>Which stations</Label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setForm({ ...form, stationIds: [] })} className={`h-10 rounded-lg px-3 text-sm font-medium ${form.stationIds.length === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              All stations
            </button>
            {stations.map((station) => {
              const on = form.stationIds.includes(station.id);
              return (
                <button
                  key={station.id}
                  type="button"
                  onClick={() => setForm({
                    ...form,
                    stationIds: on ? form.stationIds.filter((id) => id !== station.id) : [...form.stationIds, station.id],
                  })}
                  className={`h-10 rounded-lg px-3 text-sm font-medium ${on ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}
                >
                  {station.name}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="button" onClick={() => void save()}>{form.id ? "Save changes" : "Add discount"}</Button>
          {form.id && <Button type="button" variant="outline" onClick={() => setForm(BLANK)}>Cancel</Button>}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-lg font-semibold">Current discounts</h2>
        {(data || []).map((discount) => (
          <div key={discount.id} className="gz-panel flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="text-sm">
              <p className="font-medium">{discount.name}{discount.active ? "" : " · turned off"}</p>
              <p className="text-muted-foreground">
                {amountLabel(discount)} · {daySummary(discount.daysOfWeek)} · {timeSummary(discount.startTime, discount.endTime)}
                {discount.minDurationMinutes ? ` · bookings of at least ${discount.minDurationMinutes} min` : ""}
              </p>
              <p className="text-muted-foreground">{discount.stationIds.length === 0 ? "All stations" : discount.stationIds.map((id) => stationName.get(id) || "Station").join(", ")}</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => edit(discount)}>Edit</Button>
              {discount.active && <Button type="button" variant="outline" size="sm" onClick={() => void disable(discount.id)}>Turn off</Button>}
            </div>
          </div>
        ))}
        {data?.length === 0 && <p className="text-sm text-muted-foreground">No discounts. Booking totals use the full price.</p>}
      </section>
    </div>
  );
}
