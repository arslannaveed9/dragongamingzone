import { AppError } from "@/lib/errors";
import { slugify } from "@/lib/slug";
import { StationType } from "@/models/station-type";
import { Station } from "@/models/station";
import { Booking } from "@/models/booking";
import { writeAudit } from "@/services/audit-service";
import type { Actor } from "@/services/auth-service";

function typePlain(doc: {
  _id: unknown;
  name: string;
  slug: string;
  description?: string;
  active: boolean;
  sortOrder?: number;
  archived?: boolean;
}) {
  return {
    id: String(doc._id),
    name: doc.name,
    slug: doc.slug,
    description: doc.description || "",
    active: doc.active,
    sortOrder: doc.sortOrder ?? 0,
    archived: Boolean(doc.archived),
  };
}

async function uniqueSlug(name: string, ignoreId?: string) {
  const base = slugify(name);
  let slug = base;
  let n = 2;
  while (await StationType.exists({ slug, ...(ignoreId ? { _id: { $ne: ignoreId } } : {}) })) {
    slug = `${base}-${n}`;
    n += 1;
  }
  return slug;
}

export async function listStationTypes(includeArchived = false) {
  const filter = includeArchived ? {} : { archived: false };
  const rows = await StationType.find(filter).sort({ sortOrder: 1, name: 1 }).lean();
  return rows.map((row) => typePlain(row));
}

export async function createStationType(
  input: { name: string; description?: string; active?: boolean; sortOrder?: number },
  actor: Actor,
) {
  const slug = await uniqueSlug(input.name);
  const created = await StationType.create({ ...input, slug, archived: false });
  await writeAudit({
    actor,
    action: "station_type.created",
    entity: "station_type",
    entityId: String(created._id),
    newValue: { name: created.name },
  });
  return typePlain(created);
}

export async function updateStationType(
  id: string,
  input: { name: string; description?: string; active?: boolean; sortOrder?: number },
  actor: Actor,
) {
  const existing = await StationType.findById(id);
  if (!existing || existing.archived) throw new AppError(404, "NOT_FOUND", "Station type not found.");
  const previous = typePlain(existing);
  existing.name = input.name;
  existing.description = input.description || "";
  existing.active = input.active ?? existing.active;
  existing.sortOrder = input.sortOrder ?? existing.sortOrder;
  if (previous.name !== input.name) existing.slug = await uniqueSlug(input.name, id);
  await existing.save();
  await writeAudit({
    actor,
    action: "station_type.updated",
    entity: "station_type",
    entityId: id,
    oldValue: previous,
    newValue: typePlain(existing),
  });
  return typePlain(existing);
}

export async function archiveStationType(id: string, actor: Actor) {
  const inUse = await Station.countDocuments({ typeId: id, operationalStatus: { $ne: "archived" } });
  if (inUse > 0) {
    throw new AppError(400, "TYPE_IN_USE", "Reassign stations before archiving this type.");
  }
  const existing = await StationType.findById(id);
  if (!existing) throw new AppError(404, "NOT_FOUND", "Station type not found.");
  existing.archived = true;
  existing.active = false;
  await existing.save();
  await writeAudit({ actor, action: "station_type.archived", entity: "station_type", entityId: id });
  return typePlain(existing);
}

type StationPricing = {
  per30Min: number;
  perHour: number;
  additionalPer30Min: number;
  additionalPerHour: number;
  controllerOverrides: { controllerNumber: number; per30Min: number; perHour: number }[];
};

function stationPlain(doc: {
  _id: unknown;
  name: string;
  description?: string;
  operationalStatus: string;
  sortOrder?: number;
  maxControllers: number;
  pricing: StationPricing;
  typeId: { _id?: unknown; name?: string } | unknown;
}) {
  const type = doc.typeId as { _id?: unknown; name?: string } | string | null;
  const typeId = type && typeof type === "object" && "_id" in type ? String(type._id) : String(type);
  const typeName = type && typeof type === "object" && "name" in type ? type.name || "" : "";
  return {
    id: String(doc._id),
    name: doc.name,
    description: doc.description || "",
    operationalStatus: doc.operationalStatus,
    sortOrder: doc.sortOrder ?? 0,
    maxControllers: doc.maxControllers,
    pricing: {
      per30Min: doc.pricing.per30Min,
      perHour: doc.pricing.perHour,
      additionalPer30Min: doc.pricing.additionalPer30Min ?? 0,
      additionalPerHour: doc.pricing.additionalPerHour ?? 0,
      controllerOverrides: doc.pricing.controllerOverrides || [],
    },
    typeId,
    typeName,
  };
}

function assertOverrides(maxControllers: number, overrides: { controllerNumber: number }[]) {
  const seen = new Set<number>();
  for (const override of overrides) {
    if (override.controllerNumber > maxControllers) {
      throw new AppError(400, "CONTROLLERS", "Controller pricing cannot exceed the station controller limit.");
    }
    if (seen.has(override.controllerNumber)) {
      throw new AppError(400, "CONTROLLERS", "Each additional controller can only have one rate.");
    }
    seen.add(override.controllerNumber);
  }
}

export async function listStations(includeArchived = false) {
  const filter = includeArchived ? {} : { operationalStatus: { $ne: "archived" } };
  const rows = await Station.find(filter).sort({ sortOrder: 1, name: 1 }).populate("typeId").lean();
  return rows.map((row) => stationPlain(row as never));
}

export async function createStation(
  input: {
    name: string;
    typeId: string;
    description?: string;
    sortOrder?: number;
    maxControllers: number;
    operationalStatus?: "active" | "disabled" | "maintenance";
    pricing: StationPricing;
  },
  actor: Actor,
) {
  const type = await StationType.findOne({ _id: input.typeId, archived: false });
  if (!type) throw new AppError(400, "TYPE", "Choose a station type.");
  assertOverrides(input.maxControllers, input.pricing.controllerOverrides || []);
  const duplicate = await Station.findOne({ name: input.name, operationalStatus: { $ne: "archived" } });
  if (duplicate) throw new AppError(409, "DUPLICATE", "A station with this name already exists.");
  const created = await Station.create({
    ...input,
    description: input.description || "",
    operationalStatus: input.operationalStatus || "active",
  });
  await created.populate("typeId");
  await writeAudit({
    actor,
    action: "station.created",
    entity: "station",
    entityId: String(created._id),
    newValue: { name: created.name, pricing: input.pricing },
  });
  return stationPlain(created as never);
}

export async function updateStation(
  id: string,
  input: {
    name: string;
    typeId: string;
    description?: string;
    sortOrder?: number;
    maxControllers: number;
    operationalStatus?: "active" | "disabled" | "maintenance";
    pricing: StationPricing;
  },
  actor: Actor,
) {
  const existing = await Station.findById(id);
  if (!existing || existing.operationalStatus === "archived") {
    throw new AppError(404, "NOT_FOUND", "Station not found.");
  }
  const type = await StationType.findOne({ _id: input.typeId, archived: false });
  if (!type) throw new AppError(400, "TYPE", "Choose a station type.");
  assertOverrides(input.maxControllers, input.pricing.controllerOverrides || []);
  const duplicate = await Station.findOne({
    _id: { $ne: id },
    name: input.name,
    operationalStatus: { $ne: "archived" },
  });
  if (duplicate) throw new AppError(409, "DUPLICATE", "A station with this name already exists.");
  const previousPricing = existing.pricing.toObject();
  const previousStatus = existing.operationalStatus;
  if (input.operationalStatus && input.operationalStatus !== "active" && previousStatus === "active") {
    await assertNoLiveBookings(id);
  }
  existing.name = input.name;
  existing.typeId = input.typeId;
  existing.description = input.description || "";
  existing.sortOrder = input.sortOrder ?? existing.sortOrder;
  existing.maxControllers = input.maxControllers;
  existing.operationalStatus = input.operationalStatus || existing.operationalStatus;
  existing.pricing = input.pricing;
  await existing.save();
  await existing.populate("typeId");
  if (JSON.stringify(previousPricing) !== JSON.stringify(input.pricing)) {
    await writeAudit({
      actor,
      action: "pricing.changed",
      entity: "station",
      entityId: id,
      oldValue: previousPricing,
      newValue: input.pricing,
    });
  }
  if (previousStatus !== existing.operationalStatus) {
    await writeAudit({
      actor,
      action: existing.operationalStatus === "disabled" ? "station.disabled" : "station.updated",
      entity: "station",
      entityId: id,
      oldValue: { operationalStatus: previousStatus },
      newValue: { operationalStatus: existing.operationalStatus },
    });
  } else {
    await writeAudit({
      actor,
      action: "station.updated",
      entity: "station",
      entityId: id,
      oldValue: { name: existing.name },
      newValue: { name: input.name },
    });
  }
  return stationPlain(existing as never);
}

async function assertNoLiveBookings(stationId: string) {
  const blocking = await Booking.countDocuments({
    stationId,
    status: { $in: ["active", "scheduled"] },
    endAt: { $gt: new Date() },
  });
  if (blocking > 0) {
    throw new AppError(
      400,
      "STATION_IN_USE",
      "Cancel or complete existing bookings before disabling this station.",
    );
  }
}

export async function setStationStatus(
  id: string,
  operationalStatus: "active" | "disabled" | "maintenance" | "archived",
  actor: Actor,
) {
  const existing = await Station.findById(id);
  if (!existing) throw new AppError(404, "NOT_FOUND", "Station not found.");
  if (operationalStatus !== "active") await assertNoLiveBookings(id);
  const previous = existing.operationalStatus;
  existing.operationalStatus = operationalStatus;
  await existing.save();
  await existing.populate("typeId");
  await writeAudit({
    actor,
    action: operationalStatus === "archived" ? "station.archived" : operationalStatus === "disabled" ? "station.disabled" : "station.updated",
    entity: "station",
    entityId: id,
    oldValue: { operationalStatus: previous },
    newValue: { operationalStatus },
  });
  return stationPlain(existing as never);
}
