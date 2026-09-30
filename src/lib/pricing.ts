import { isMinutesInWindow, localMinutes, weekdayIndex } from "@/lib/gaming-day";
import { roundMoney } from "@/lib/money";

/**
 * Central price calculation.
 *
 * Play time is billed as full hours at the hourly rate, plus a prorated
 * 30-minute rate for the remainder. A 90-minute session is one hourly block
 * plus one 30-minute block. The first controller is included in the base
 * rate. Each extra controller uses its own override or the station's
 * additional-controller rate.
 *
 * One pricing rule may replace the base rates (station-specific beats
 * type-specific beats global). One discount — the largest saving — is then
 * applied to the subtotal. Discounts are not stacked.
 */

export type DiscountLike = {
  id: string;
  name: string;
  type: "percentage" | "fixed";
  value: number;
  startTime?: string | null;
  endTime?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  daysOfWeek: number[];
  stationIds: string[];
  stationTypeIds: string[];
  minDurationMinutes?: number | null;
  priority: number;
  active: boolean;
};

export type PricingRuleLike = {
  id: string;
  name: string;
  active: boolean;
  priority: number;
  stationIds: string[];
  stationTypeIds: string[];
  daysOfWeek: number[];
  startTime?: string | null;
  endTime?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  basePer30Min: number;
  basePerHour: number;
  additionalPer30Min?: number | null;
  additionalPerHour?: number | null;
};

export type ControllerOverride = {
  controllerNumber: number;
  per30Min: number;
  perHour: number;
};

export type RateContext = {
  stationId: string;
  stationTypeId: string;
  gamingDay: string;
  timezone: string;
  startAt: Date;
  durationMinutes: number;
};

export type ResolvedRates = {
  per30Min: number;
  perHour: number;
  additionalPer30Min: number;
  additionalPerHour: number;
  appliedRule: { id: string; name: string } | null;
};

export type PriceQuote = {
  baseAmount: number;
  controllerAmount: number;
  discountAmount: number;
  subtotal: number;
  finalAmount: number;
  appliedDiscount: { id: string; name: string; type: "percentage" | "fixed"; value: number } | null;
  appliedRule: { id: string; name: string } | null;
  pricingBreakdown: {
    base: { per30Min: number; perHour: number; hours: number; remainderMinutes: number; amount: number };
    controllers: {
      controllerNumber: number;
      per30Min: number;
      perHour: number;
      amount: number;
    }[];
    discount: { id: string; name: string; type: "percentage" | "fixed"; value: number; amount: number } | null;
  };
};

type Windowed = {
  active: boolean;
  startTime?: string | null;
  endTime?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  daysOfWeek: number[];
  stationIds: string[];
  stationTypeIds: string[];
  minDurationMinutes?: number | null;
};

export function matchesSchedule(item: Windowed, ctx: RateContext): boolean {
  if (!item.active) return false;
  if (item.startDate && ctx.gamingDay < item.startDate) return false;
  if (item.endDate && ctx.gamingDay > item.endDate) return false;
  if (item.daysOfWeek.length > 0) {
    const day = weekdayIndex(ctx.gamingDay, ctx.timezone);
    if (!item.daysOfWeek.includes(day)) return false;
  }
  if (item.stationIds.length > 0 && !item.stationIds.includes(ctx.stationId)) return false;
  if (item.stationTypeIds.length > 0 && !item.stationTypeIds.includes(ctx.stationTypeId)) return false;
  if (item.minDurationMinutes && ctx.durationMinutes < item.minDurationMinutes) return false;
  const minutes = localMinutes(ctx.startAt, ctx.timezone);
  return isMinutesInWindow(minutes, item.startTime, item.endTime);
}

function specificity(item: { stationIds: string[]; stationTypeIds: string[] }): number {
  if (item.stationIds.length > 0) return 3;
  if (item.stationTypeIds.length > 0) return 2;
  return 1;
}

export function resolveRates(
  base: {
    per30Min: number;
    perHour: number;
    additionalPer30Min: number;
    additionalPerHour: number;
  },
  rules: PricingRuleLike[],
  ctx: RateContext,
): ResolvedRates {
  const matches = rules
    .filter((rule) => matchesSchedule(rule, ctx))
    .sort((a, b) => specificity(b) - specificity(a) || b.priority - a.priority);

  const winner = matches[0];
  if (!winner) {
    return { ...base, appliedRule: null };
  }
  return {
    per30Min: winner.basePer30Min,
    perHour: winner.basePerHour,
    additionalPer30Min: winner.additionalPer30Min ?? base.additionalPer30Min,
    additionalPerHour: winner.additionalPerHour ?? base.additionalPerHour,
    appliedRule: { id: winner.id, name: winner.name },
  };
}

export function priceDuration(minutes: number, per30Min: number, perHour: number): number {
  if (minutes <= 0) return 0;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return roundMoney(hours * perHour + (remainder / 30) * per30Min);
}

export function discountAmountFor(
  subtotal: number,
  discount: { type: "percentage" | "fixed"; value: number },
): number {
  if (discount.type === "percentage") {
    return roundMoney(subtotal * (discount.value / 100));
  }
  return roundMoney(Math.min(subtotal, Math.max(0, discount.value)));
}

export function selectDiscount(discounts: DiscountLike[], ctx: RateContext, subtotal: number): DiscountLike | null {
  const matches = discounts.filter((discount) => matchesSchedule(discount, ctx));
  if (matches.length === 0) return null;
  return matches.sort((a, b) => {
    const save = discountAmountFor(subtotal, b) - discountAmountFor(subtotal, a);
    if (save !== 0) return save;
    return b.priority - a.priority;
  })[0];
}

export function calculateBookingPrice(input: {
  durationMinutes: number;
  controllerCount: number;
  rates: ResolvedRates;
  overrides: ControllerOverride[];
  discount: DiscountLike | null;
}): PriceQuote {
  const hours = Math.floor(input.durationMinutes / 60);
  const remainderMinutes = input.durationMinutes % 60;
  const baseAmount = priceDuration(input.durationMinutes, input.rates.per30Min, input.rates.perHour);
  const controllers: PriceQuote["pricingBreakdown"]["controllers"] = [];
  let controllerAmount = 0;
  const extras = Math.max(0, input.controllerCount - 1);
  for (let index = 0; index < extras; index += 1) {
    const controllerNumber = index + 2;
    const override = input.overrides.find((item) => item.controllerNumber === controllerNumber);
    const per30Min = override?.per30Min ?? input.rates.additionalPer30Min;
    const perHour = override?.perHour ?? input.rates.additionalPerHour;
    const amount = priceDuration(input.durationMinutes, per30Min, perHour);
    controllerAmount = roundMoney(controllerAmount + amount);
    controllers.push({ controllerNumber, per30Min, perHour, amount });
  }
  const subtotal = roundMoney(baseAmount + controllerAmount);
  const applied = input.discount;
  const discountAmount = applied ? discountAmountFor(subtotal, applied) : 0;
  const finalAmount = roundMoney(Math.max(0, subtotal - discountAmount));
  return {
    baseAmount,
    controllerAmount,
    discountAmount,
    subtotal,
    finalAmount,
    appliedDiscount: applied
      ? { id: applied.id, name: applied.name, type: applied.type, value: applied.value }
      : null,
    appliedRule: input.rates.appliedRule,
    pricingBreakdown: {
      base: {
        per30Min: input.rates.per30Min,
        perHour: input.rates.perHour,
        hours,
        remainderMinutes,
        amount: baseAmount,
      },
      controllers,
      discount: applied
        ? {
            id: applied.id,
            name: applied.name,
            type: applied.type,
            value: applied.value,
            amount: discountAmount,
          }
        : null,
    },
  };
}

/**
 * Latest legal end instant. A following booking that starts exactly at this
 * end is allowed — the intervals touch but do not overlap.
 */
export function latestAllowedEnd(gamingDayEnd: Date, nextStart: Date | null): Date {
  if (nextStart && nextStart.getTime() < gamingDayEnd.getTime()) return nextStart;
  return gamingDayEnd;
}
