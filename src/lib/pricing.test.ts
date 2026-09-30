import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import {
  calculateBookingPrice,
  priceDuration,
  resolveRates,
  selectDiscount,
  type DiscountLike,
  type ResolvedRates,
} from "@/lib/pricing";

const rates: ResolvedRates = {
  per30Min: 150,
  perHour: 250,
  additionalPer30Min: 30,
  additionalPerHour: 50,
  appliedRule: null,
};

function discount(partial: Partial<DiscountLike> & Pick<DiscountLike, "id" | "name" | "type" | "value">): DiscountLike {
  return {
    startTime: null,
    endTime: null,
    startDate: null,
    endDate: null,
    daysOfWeek: [],
    stationIds: [],
    stationTypeIds: [],
    minDurationMinutes: null,
    priority: 0,
    active: true,
    ...partial,
  };
}

describe("pricing engine", () => {
  it("bills full hours plus a 30-minute remainder", () => {
    expect(priceDuration(60, 150, 250)).toBe(250);
    expect(priceDuration(30, 150, 250)).toBe(150);
    expect(priceDuration(90, 150, 250)).toBe(400);
    expect(priceDuration(120, 150, 250)).toBe(500);
  });

  it("adds each extra controller and applies the larger discount", () => {
    const quote = calculateBookingPrice({
      durationMinutes: 60,
      controllerCount: 2,
      rates,
      overrides: [],
      discount: discount({ id: "d1", name: "Weekday", type: "percentage", value: 20 }),
    });
    expect(quote.baseAmount).toBe(250);
    expect(quote.controllerAmount).toBe(50);
    expect(quote.subtotal).toBe(300);
    expect(quote.discountAmount).toBe(60);
    expect(quote.finalAmount).toBe(240);
  });

  it("uses a controller-specific override and never stacks discounts", () => {
    const quote = calculateBookingPrice({
      durationMinutes: 60,
      controllerCount: 3,
      rates,
      overrides: [{ controllerNumber: 2, per30Min: 0, perHour: 80 }],
      discount: null,
    });
    expect(quote.pricingBreakdown.controllers[0].amount).toBe(80);
    expect(quote.pricingBreakdown.controllers[1].amount).toBe(50);
    expect(quote.controllerAmount).toBe(130);
  });

  it("caps a fixed discount at the subtotal", () => {
    const quote = calculateBookingPrice({
      durationMinutes: 30,
      controllerCount: 1,
      rates,
      overrides: [],
      discount: discount({ id: "d2", name: "Fixed", type: "fixed", value: 500 }),
    });
    expect(quote.finalAmount).toBe(0);
    expect(quote.discountAmount).toBe(150);
  });

  it("matches a weekday afternoon discount using the gaming day, not the calendar morning", () => {
    const happyHour = discount({
      id: "hh",
      name: "Afternoon",
      type: "percentage",
      value: 20,
      startTime: "14:00",
      endTime: "18:00",
      daysOfWeek: [1, 2, 3, 4],
      minDurationMinutes: 60,
    });
    const monday = DateTime.fromObject(
      { year: 2026, month: 9, day: 28, hour: 15 },
      { zone: "Asia/Karachi" },
    ).toJSDate();
    const ctx = {
      stationId: "s1",
      stationTypeId: "t1",
      gamingDay: "2026-09-28",
      timezone: "Asia/Karachi",
      startAt: monday,
      durationMinutes: 60,
    };
    expect(selectDiscount([happyHour], ctx, 250)?.id).toBe("hh");
    expect(selectDiscount([happyHour], { ...ctx, durationMinutes: 30 }, 150)).toBeNull();
    const overnight = DateTime.fromObject(
      { year: 2026, month: 9, day: 29, hour: 1 },
      { zone: "Asia/Karachi" },
    ).toJSDate();
    expect(
      selectDiscount([happyHour], { ...ctx, startAt: overnight, gamingDay: "2026-09-28" }, 250),
    ).toBeNull();
  });

  it("lets a station rule replace the base rate", () => {
    const resolved = resolveRates(rates, [
      {
        id: "r1",
        name: "Promo",
        active: true,
        priority: 5,
        stationIds: ["s1"],
        stationTypeIds: [],
        daysOfWeek: [],
        startTime: null,
        endTime: null,
        startDate: null,
        endDate: null,
        basePer30Min: 100,
        basePerHour: 180,
        additionalPer30Min: null,
        additionalPerHour: null,
      },
    ], {
      stationId: "s1",
      stationTypeId: "t1",
      gamingDay: "2026-09-29",
      timezone: "Asia/Karachi",
      startAt: new Date("2026-09-29T10:00:00+05:00"),
      durationMinutes: 60,
    });
    expect(resolved.perHour).toBe(180);
    expect(resolved.additionalPerHour).toBe(50);
    expect(resolved.appliedRule?.name).toBe("Promo");
  });
});
