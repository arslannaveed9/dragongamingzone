"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, money, usePoll } from "@/components/admin/client";
import { DayPicker, daySummary, timeSummary } from "@/components/admin/schedule-fields";

type Rule = {
  id: string;
  name: string;
  active: boolean;
  priority: number;
  basePer30Min: number;
  basePerHour: number;
  additionalPer30Min: number | null;
  additionalPerHour: number | null;
  daysOfWeek: number[];
  startTime: string | null;
  endTime: string | null;
  stationIds: string[];
};

type Station = {
  id: string;
  name: string;
  typeName: string;
  operationalStatus: string;
  pricing: { per30Min: number; perHour: number; additionalPer30Min: number; additionalPerHour: number };
};

type Catalog = {
  stations: Station[];
  system?: { currencySymbol?: string };
};

type Draft = {
  id: string | null;
  name: string;
  basePer30Min: string;
  basePerHour: string;
  extra: boolean;
  additionalPer30Min: string;
  additionalPerHour: string;
  limitedHours: boolean;
  startTime: string;
  endTime: string;
  days: number[];
  stationIds: string[];
  priority: number;
  active: boolean;
};

const BLANK: Draft = {
  id: null,
  name: "",
  basePer30Min: "",
  basePerHour: "",
  extra: false,
  additionalPer30Min: "",
  additionalPerHour: "",
  limitedHours: false,
  startTime: "18:00",
  endTime: "23:00",
  days: [],
  stationIds: [],
  priority: 0,
  active: true,
};

export default function PricingPage() {
  const { data: rules, reload } = usePoll<Rule[]>("/api/pricing-rules");
  const { data: catalog } = usePoll<Catalog>("/api/stations");
  const [form, setForm] = useState<Draft>(BLANK);
  const symbol = catalog?.system?.currencySymbol || "Rs";
  const stations = (catalog?.stations || []).filter((station) => station.operationalStatus !== "archived");
  const stationName = new Map(stations.map((station) => [station.id, station.name]));

  function edit(rule: Rule) {
    setForm({
      id: rule.id,
      name: rule.name,
      basePer30Min: String(rule.basePer30Min),
      basePerHour: String(rule.basePerHour),
      extra: rule.additionalPer30Min != null || rule.additionalPerHour != null,
      additionalPer30Min: rule.additionalPer30Min == null ? "" : String(rule.additionalPer30Min),
      additionalPerHour: rule.additionalPerHour == null ? "" : String(rule.additionalPerHour),
      limitedHours: Boolean(rule.startTime && rule.endTime),
      startTime: rule.startTime || "18:00",
      endTime: rule.endTime || "23:00",
      days: rule.daysOfWeek,
      stationIds: rule.stationIds,
      priority: rule.priority,
      active: rule.active,
    });
  }

  async function save() {
    const basePer30Min = Number(form.basePer30Min);
    const basePerHour = Number(form.basePerHour);
    if (!form.name.trim()) {
      toast.error("Give the special rate a name, such as Weekend night.");
      return;
    }
    if (!Number.isFinite(basePer30Min) || !Number.isFinite(basePerHour) || basePer30Min < 0 || basePerHour < 0) {
      toast.error("Enter the 30-minute price and the hourly price.");
      return;
    }
    if (form.limitedHours && (!form.startTime || !form.endTime)) {
      toast.error("Set both a start time and an end time, or leave it as all day.");
      return;
    }
    const additionalPer30Min = form.extra ? Number(form.additionalPer30Min || 0) : null;
    const additionalPerHour = form.extra ? Number(form.additionalPerHour || 0) : null;
    try {
      await api(form.id ? `/api/pricing-rules/${form.id}` : "/api/pricing-rules", {
        method: form.id ? "PATCH" : "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          basePer30Min,
          basePerHour,
          additionalPer30Min,
          additionalPerHour,
          startTime: form.limitedHours ? form.startTime : null,
          endTime: form.limitedHours ? form.endTime : null,
          daysOfWeek: form.days,
          stationIds: form.stationIds,
          stationTypeIds: [],
          priority: form.priority,
          active: form.active,
        }),
      });
      setForm(BLANK);
      toast.success(form.id ? "Special rate updated." : "Special rate saved. It replaces the station price when a booking starts in this window.");
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the special rate.");
    }
  }

  async function disable(id: string) {
    await api(`/api/pricing-rules/${id}`, { method: "DELETE" });
    if (form.id === id) setForm(BLANK);
    await reload();
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="gz-kicker text-cyan-800 dark:text-cyan-200">Rates</p>
        <h1 className="gz-title">Pricing</h1>
        <p className="mt-2 max-w-3xl text-base text-muted-foreground">
          Each station already has an everyday price. A special rate below replaces that price only when a booking starts on the days and times you choose. The first controller is included. Extra controllers use the station’s extra-controller price unless you set a different one here.
        </p>
      </div>

      <section className="gz-panel p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-heading text-lg font-semibold">Everyday station prices</h2>
            <p className="text-sm text-muted-foreground">These are used whenever no special rate matches.</p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/dashboard/stations">Change on Stations</Link>
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-2 pr-3 font-medium">Station</th>
                <th className="py-2 pr-3 font-medium">30 minutes</th>
                <th className="py-2 pr-3 font-medium">1 hour</th>
                <th className="py-2 font-medium">Each extra controller</th>
              </tr>
            </thead>
            <tbody>
              {stations.map((station) => (
                <tr key={station.id} className="border-t border-border">
                  <td className="py-2 pr-3 font-medium">{station.name}{station.typeName ? ` · ${station.typeName}` : ""}</td>
                  <td className="py-2 pr-3 tabular-nums">{money(station.pricing.per30Min, symbol)}</td>
                  <td className="py-2 pr-3 tabular-nums">{money(station.pricing.perHour, symbol)}</td>
                  <td className="py-2 tabular-nums">{money(station.pricing.additionalPer30Min, symbol)} / 30 min · {money(station.pricing.additionalPerHour, symbol)} / hour</td>
                </tr>
              ))}
            </tbody>
          </table>
          {stations.length === 0 && <p className="text-sm text-muted-foreground">No stations yet. Add them on the Stations page.</p>}
        </div>
      </section>

      <section className="gz-panel space-y-4 p-4">
        <div>
          <h2 className="font-heading text-lg font-semibold">{form.id ? "Edit special rate" : "Add a special rate"}</h2>
          <p className="text-sm text-muted-foreground">Example: Weekend night, {money(200, symbol)} / 30 min, {money(350, symbol)} / hour, Friday to Sunday, 6:00 PM–11:00 PM.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5 md:col-span-3">
            <Label htmlFor="rate-name">Name</Label>
            <Input id="rate-name" value={form.name} placeholder="Weekend night" onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rate-30">Price for 30 minutes</Label>
            <Input id="rate-30" type="number" min={0} value={form.basePer30Min} placeholder="200" onChange={(event) => setForm({ ...form, basePer30Min: event.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rate-60">Price for 1 hour</Label>
            <Input id="rate-60" type="number" min={0} value={form.basePerHour} placeholder="350" onChange={(event) => setForm({ ...form, basePerHour: event.target.value })} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.extra} onChange={(event) => setForm({ ...form, extra: event.target.checked })} />
          Use a different price for each extra controller
        </label>
        {form.extra && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="extra-30">Extra controller, 30 minutes</Label>
              <Input id="extra-30" type="number" min={0} value={form.additionalPer30Min} onChange={(event) => setForm({ ...form, additionalPer30Min: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="extra-60">Extra controller, 1 hour</Label>
              <Input id="extra-60" type="number" min={0} value={form.additionalPerHour} onChange={(event) => setForm({ ...form, additionalPerHour: event.target.value })} />
            </div>
          </div>
        )}
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
              <Label htmlFor="rate-from">From</Label>
              <Input id="rate-from" type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rate-until">Until</Label>
              <Input id="rate-until" type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} />
              <p className="text-sm text-muted-foreground">The end can be after midnight, such as 6:00 PM until 1:00 AM.</p>
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
          <Button type="button" onClick={() => void save()}>{form.id ? "Save changes" : "Add special rate"}</Button>
          {form.id && <Button type="button" variant="outline" onClick={() => setForm(BLANK)}>Cancel</Button>}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-lg font-semibold">Special rates</h2>
        {(rules || []).map((rule) => (
          <div key={rule.id} className="gz-panel flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="text-sm">
              <p className="font-medium">{rule.name}{rule.active ? "" : " · turned off"}</p>
              <p className="text-muted-foreground">
                {money(rule.basePer30Min, symbol)} / 30 min · {money(rule.basePerHour, symbol)} / hour
                {rule.additionalPerHour == null && rule.additionalPer30Min == null
                  ? " · extra controllers stay on the station price"
                  : ` · extra controller ${money(rule.additionalPer30Min || 0, symbol)} / 30 min, ${money(rule.additionalPerHour || 0, symbol)} / hour`}
              </p>
              <p className="text-muted-foreground">
                {daySummary(rule.daysOfWeek)} · {timeSummary(rule.startTime, rule.endTime)} · {rule.stationIds.length === 0 ? "All stations" : rule.stationIds.map((id) => stationName.get(id) || "Station").join(", ")}
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => edit(rule)}>Edit</Button>
              {rule.active && <Button type="button" variant="outline" size="sm" onClick={() => void disable(rule.id)}>Turn off</Button>}
            </div>
          </div>
        ))}
        {rules?.length === 0 && <p className="text-sm text-muted-foreground">No special rates. Bookings use the everyday station prices.</p>}
      </section>
    </div>
  );
}
