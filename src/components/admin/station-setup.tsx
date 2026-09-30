"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, notifyRefresh } from "@/components/admin/client";

type StationType = { id: string; name: string; description: string };
type Station = {
  id: string;
  name: string;
  typeId: string;
  description: string;
  operationalStatus: string;
  maxControllers: number;
  sortOrder: number;
  pricing: {
    per30Min: number;
    perHour: number;
    additionalPer30Min: number;
    additionalPerHour: number;
    controllerOverrides: { controllerNumber: number; per30Min: number; perHour: number }[];
  };
};

const EMPTY = {
  name: "",
  typeId: "",
  description: "",
  maxControllers: 4,
  operationalStatus: "active",
  per30Min: 0,
  perHour: 0,
  additionalPer30Min: 0,
  additionalPerHour: 0,
};

export function StationSetup() {
  const [types, setTypes] = useState<StationType[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [typeName, setTypeName] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);

  async function load() {
    const data = await api<{ stations: Station[]; types: StationType[]; pricingDefaults: typeof EMPTY }>("/api/stations?archived=1");
    setStations(data.stations);
    setTypes(data.types);
    if (!form.typeId && data.types[0]) setForm((current) => ({ ...current, typeId: data.types[0].id, ...(!editing ? {
      per30Min: data.pricingDefaults.per30Min,
      perHour: data.pricingDefaults.perHour,
      additionalPer30Min: data.pricingDefaults.additionalPer30Min,
      additionalPerHour: data.pricingDefaults.additionalPerHour,
      maxControllers: data.pricingDefaults.maxControllers,
    } : {}) }));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial station list
    load().catch((error: Error) => toast.error(error.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once when the setup tab mounts
  }, []);

  function payload() {
    return {
      name: form.name,
      typeId: form.typeId,
      description: form.description,
      maxControllers: Number(form.maxControllers),
      operationalStatus: form.operationalStatus,
      sortOrder: 0,
      pricing: {
        per30Min: Number(form.per30Min),
        perHour: Number(form.perHour),
        additionalPer30Min: Number(form.additionalPer30Min),
        additionalPerHour: Number(form.additionalPerHour),
        controllerOverrides: [],
      },
    };
  }

  async function saveStation() {
    try {
      if (editing) await api(`/api/stations/${editing}`, { method: "PATCH", body: JSON.stringify(payload()) });
      else await api("/api/stations", { method: "POST", body: JSON.stringify(payload()) });
      toast.success(editing ? "Station updated." : "Station added.");
      setEditing(null);
      setForm({ ...EMPTY, typeId: form.typeId });
      notifyRefresh();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the station.");
    }
  }

  async function addType() {
    try {
      await api("/api/station-types", { method: "POST", body: JSON.stringify({ name: typeName, description: "", active: true, sortOrder: types.length }) });
      setTypeName("");
      toast.success("Station type added.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add the type.");
    }
  }

  async function setStatus(id: string, operationalStatus: string) {
    try {
      await api(`/api/stations/${id}`, { method: "PATCH", body: JSON.stringify({ operationalStatus }) });
      toast.success("Station updated.");
      notifyRefresh();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the station.");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <form className="space-y-3 rounded-xl border border-border bg-card p-4" onSubmit={(event) => { event.preventDefault(); void saveStation(); }}>
        <h2 className="font-medium">{editing ? "Edit station" : "Add station"}</h2>
        <div><Label>Name</Label><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="PS5-01" /></div>
        <div>
          <Label>Type</Label>
          <select className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-2 text-sm" value={form.typeId} onChange={(event) => setForm({ ...form, typeId: event.target.value })}>
            {types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
          </select>
        </div>
        <div><Label>Description</Label><Input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>30 min</Label><Input type="number" min={0} value={form.per30Min} onChange={(event) => setForm({ ...form, per30Min: Number(event.target.value) })} /></div>
          <div><Label>1 hour</Label><Input type="number" min={0} value={form.perHour} onChange={(event) => setForm({ ...form, perHour: Number(event.target.value) })} /></div>
          <div><Label>Extra 30 min</Label><Input type="number" min={0} value={form.additionalPer30Min} onChange={(event) => setForm({ ...form, additionalPer30Min: Number(event.target.value) })} /></div>
          <div><Label>Extra / hour</Label><Input type="number" min={0} value={form.additionalPerHour} onChange={(event) => setForm({ ...form, additionalPerHour: Number(event.target.value) })} /></div>
        </div>
        <div><Label>Max controllers</Label><Input type="number" min={1} max={12} value={form.maxControllers} onChange={(event) => setForm({ ...form, maxControllers: Number(event.target.value) })} /></div>
        <Button type="submit" className="w-full">{editing ? "Save changes" : "Add station"}</Button>
        <div className="flex gap-2">
          <Input value={typeName} onChange={(event) => setTypeName(event.target.value)} placeholder="New station type" />
          <Button type="button" variant="outline" onClick={addType}>Add type</Button>
        </div>
      </form>
      <div className="space-y-2">
        {stations.length === 0 && <p className="text-sm text-muted-foreground">No stations configured.</p>}
        {stations.map((station) => (
          <div key={station.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3">
            <div>
              <p className="font-medium">{station.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{station.operationalStatus} · {station.maxControllers} controllers · {station.pricing.perHour}/hr</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => {
                setEditing(station.id);
                setForm({
                  name: station.name,
                  typeId: station.typeId,
                  description: station.description,
                  maxControllers: station.maxControllers,
                  operationalStatus: station.operationalStatus,
                  per30Min: station.pricing.per30Min,
                  perHour: station.pricing.perHour,
                  additionalPer30Min: station.pricing.additionalPer30Min,
                  additionalPerHour: station.pricing.additionalPerHour,
                });
              }}>Edit</Button>
              {station.operationalStatus === "active" ? (
                <Button size="sm" variant="outline" onClick={() => setStatus(station.id, "maintenance")}>Maintenance</Button>
              ) : station.operationalStatus !== "archived" ? (
                <Button size="sm" variant="outline" onClick={() => setStatus(station.id, "active")}>Enable</Button>
              ) : null}
              {station.operationalStatus !== "archived" && (
                <>
                  <Button size="sm" variant="outline" onClick={() => setStatus(station.id, station.operationalStatus === "disabled" ? "active" : "disabled")}>{station.operationalStatus === "disabled" ? "Enable" : "Disable"}</Button>
                  <Button size="sm" variant="destructive" onClick={() => { if (confirm(`Archive ${station.name}? Historical bookings stay in the record.`)) void setStatus(station.id, "archived"); }}>Archive</Button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
