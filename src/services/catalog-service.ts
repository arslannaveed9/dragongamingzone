import { AppError } from "@/lib/errors";
import { Discount } from "@/models/discount";
import { PricingRule } from "@/models/pricing-rule";
import { writeAudit } from "@/services/audit-service";
import type { Actor } from "@/services/auth-service";

function ids(value: unknown[] | undefined) {
  return (value || []).map(String);
}

function discountPlain(doc: {
  _id: unknown;
  name: string;
  type: string;
  value: number;
  startTime?: string | null;
  endTime?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  daysOfWeek?: number[];
  stationIds?: unknown[];
  stationTypeIds?: unknown[];
  minDurationMinutes?: number | null;
  priority?: number;
  active?: boolean;
}) {
  return {
    id: String(doc._id),
    name: doc.name,
    type: doc.type,
    value: doc.value,
    startTime: doc.startTime || null,
    endTime: doc.endTime || null,
    startDate: doc.startDate || null,
    endDate: doc.endDate || null,
    daysOfWeek: doc.daysOfWeek || [],
    stationIds: ids(doc.stationIds),
    stationTypeIds: ids(doc.stationTypeIds),
    minDurationMinutes: doc.minDurationMinutes ?? null,
    priority: doc.priority ?? 0,
    active: doc.active !== false,
  };
}

function rulePlain(doc: {
  _id: unknown;
  name: string;
  active?: boolean;
  priority?: number;
  stationIds?: unknown[];
  stationTypeIds?: unknown[];
  daysOfWeek?: number[];
  startTime?: string | null;
  endTime?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  basePer30Min: number;
  basePerHour: number;
  additionalPer30Min?: number | null;
  additionalPerHour?: number | null;
  kind?: string;
}) {
  return {
    id: String(doc._id),
    name: doc.name,
    active: doc.active !== false,
    priority: doc.priority ?? 0,
    stationIds: ids(doc.stationIds),
    stationTypeIds: ids(doc.stationTypeIds),
    daysOfWeek: doc.daysOfWeek || [],
    startTime: doc.startTime || null,
    endTime: doc.endTime || null,
    startDate: doc.startDate || null,
    endDate: doc.endDate || null,
    basePer30Min: doc.basePer30Min,
    basePerHour: doc.basePerHour,
    additionalPer30Min: doc.additionalPer30Min ?? null,
    additionalPerHour: doc.additionalPerHour ?? null,
    kind: doc.kind || "special",
  };
}

export async function listDiscounts() {
  const rows = await Discount.find().sort({ active: -1, name: 1 }).lean();
  return rows.map((row) => discountPlain(row as never));
}

export async function saveDiscount(id: string | null, input: Record<string, unknown>, actor: Actor) {
  if (id) {
    const existing = await Discount.findById(id);
    if (!existing) throw new AppError(404, "NOT_FOUND", "Discount not found.");
    const previous = discountPlain(existing);
    Object.assign(existing, input);
    await existing.save();
    await writeAudit({ actor, action: "discount.updated", entity: "discount", entityId: id, oldValue: previous, newValue: discountPlain(existing) });
    return discountPlain(existing);
  }
  const created = await Discount.create(input);
  await writeAudit({ actor, action: "discount.created", entity: "discount", entityId: String(created._id), newValue: discountPlain(created) });
  return discountPlain(created);
}

export async function archiveDiscount(id: string, actor: Actor) {
  const existing = await Discount.findById(id);
  if (!existing) throw new AppError(404, "NOT_FOUND", "Discount not found.");
  existing.active = false;
  await existing.save();
  await writeAudit({ actor, action: "discount.disabled", entity: "discount", entityId: id });
  return discountPlain(existing);
}

export async function listPricingRules() {
  const rows = await PricingRule.find().sort({ active: -1, priority: -1, name: 1 }).lean();
  return rows.map((row) => rulePlain(row as never));
}

export async function savePricingRule(id: string | null, input: Record<string, unknown>, actor: Actor) {
  if (id) {
    const existing = await PricingRule.findById(id);
    if (!existing) throw new AppError(404, "NOT_FOUND", "Pricing rule not found.");
    const previous = rulePlain(existing);
    Object.assign(existing, input);
    await existing.save();
    await writeAudit({ actor, action: "pricing_rule.updated", entity: "pricing_rule", entityId: id, oldValue: previous, newValue: rulePlain(existing) });
    return rulePlain(existing);
  }
  const created = await PricingRule.create({ ...input, kind: "special" });
  await writeAudit({ actor, action: "pricing_rule.created", entity: "pricing_rule", entityId: String(created._id), newValue: rulePlain(created) });
  return rulePlain(created);
}

export async function archivePricingRule(id: string, actor: Actor) {
  const existing = await PricingRule.findById(id);
  if (!existing) throw new AppError(404, "NOT_FOUND", "Pricing rule not found.");
  existing.active = false;
  await existing.save();
  await writeAudit({ actor, action: "pricing_rule.disabled", entity: "pricing_rule", entityId: id });
  return rulePlain(existing);
}
