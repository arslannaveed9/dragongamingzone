import {
  calculateBookingPrice,
  resolveRates,
  selectDiscount,
  type DiscountLike,
  type PricingRuleLike,
  type PriceQuote,
} from "@/lib/pricing";
import { Discount } from "@/models/discount";
import { PricingRule } from "@/models/pricing-rule";
import type { AppSettings } from "@/services/settings-service";

type StationPricing = {
  per30Min: number;
  perHour: number;
  additionalPer30Min?: number;
  additionalPerHour?: number;
  controllerOverrides?: { controllerNumber: number; per30Min: number; perHour: number }[];
};

function asDiscount(doc: {
  _id: unknown;
  name: string;
  type: "percentage" | "fixed";
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
}): DiscountLike {
  return {
    id: String(doc._id),
    name: doc.name,
    type: doc.type,
    value: doc.value,
    startTime: doc.startTime,
    endTime: doc.endTime,
    startDate: doc.startDate,
    endDate: doc.endDate,
    daysOfWeek: doc.daysOfWeek || [],
    stationIds: (doc.stationIds || []).map(String),
    stationTypeIds: (doc.stationTypeIds || []).map(String),
    minDurationMinutes: doc.minDurationMinutes,
    priority: doc.priority ?? 0,
    active: doc.active !== false,
  };
}

function asRule(doc: {
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
}): PricingRuleLike {
  return {
    id: String(doc._id),
    name: doc.name,
    active: doc.active !== false,
    priority: doc.priority ?? 0,
    stationIds: (doc.stationIds || []).map(String),
    stationTypeIds: (doc.stationTypeIds || []).map(String),
    daysOfWeek: doc.daysOfWeek || [],
    startTime: doc.startTime,
    endTime: doc.endTime,
    startDate: doc.startDate,
    endDate: doc.endDate,
    basePer30Min: doc.basePer30Min,
    basePerHour: doc.basePerHour,
    additionalPer30Min: doc.additionalPer30Min,
    additionalPerHour: doc.additionalPerHour,
  };
}

export type PriceCatalog = { rules: PricingRuleLike[]; discounts: DiscountLike[] };

export async function loadPriceCatalog(): Promise<PriceCatalog> {
  const [rules, discounts] = await Promise.all([
    PricingRule.find({ active: true }).lean(),
    Discount.find({ active: true }).lean(),
  ]);
  return {
    rules: rules.map((rule) => asRule(rule as never)),
    discounts: discounts.map((item) => asDiscount(item as never)),
  };
}

export function quoteWithCatalog(
  input: {
    stationId: string;
    stationTypeId: string;
    pricing: StationPricing;
    startAt: Date;
    durationMinutes: number;
    controllerCount: number;
    gamingDay: string;
    settings: AppSettings;
  },
  catalog: PriceCatalog,
): PriceQuote {
  const ctx = {
    stationId: input.stationId,
    stationTypeId: input.stationTypeId,
    gamingDay: input.gamingDay,
    timezone: input.settings.operatingHours.timezone,
    startAt: input.startAt,
    durationMinutes: input.durationMinutes,
  };
  const rates = resolveRates(
    {
      per30Min: input.pricing.per30Min,
      perHour: input.pricing.perHour,
      additionalPer30Min: input.pricing.additionalPer30Min ?? 0,
      additionalPerHour: input.pricing.additionalPerHour ?? 0,
    },
    catalog.rules,
    ctx,
  );
  const preview = calculateBookingPrice({
    durationMinutes: input.durationMinutes,
    controllerCount: input.controllerCount,
    rates,
    overrides: input.pricing.controllerOverrides || [],
    discount: null,
  });
  const discount = selectDiscount(catalog.discounts, ctx, preview.subtotal);
  return calculateBookingPrice({
    durationMinutes: input.durationMinutes,
    controllerCount: input.controllerCount,
    rates,
    overrides: input.pricing.controllerOverrides || [],
    discount,
  });
}

export async function quoteBooking(input: {
  stationId: string;
  stationTypeId: string;
  pricing: StationPricing;
  startAt: Date;
  durationMinutes: number;
  controllerCount: number;
  gamingDay: string;
  settings: AppSettings;
}): Promise<PriceQuote> {
  return quoteWithCatalog(input, await loadPriceCatalog());
}

export function priceSnapshot(quote: PriceQuote, currency: string) {
  return {
    baseAmount: quote.baseAmount,
    controllerAmount: quote.controllerAmount,
    discountAmount: quote.discountAmount,
    subtotal: quote.subtotal,
    finalAmount: quote.finalAmount,
    currency,
    appliedDiscountId: quote.appliedDiscount?.id ?? null,
    appliedDiscountName: quote.appliedDiscount?.name ?? "",
    appliedRuleId: quote.appliedRule?.id ?? null,
    appliedRuleName: quote.appliedRule?.name ?? "",
    breakdown: quote.pricingBreakdown,
  };
}
