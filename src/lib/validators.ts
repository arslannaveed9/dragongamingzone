import { z } from "zod";

const timeHm = z.string().regex(/^\d{2}:\d{2}$/, "Use HH:mm.");
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.");
const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id.");

export const loginSchema = z.object({
  email: z.string().trim().min(3).max(160),
  password: z.string().min(8).max(200),
});

export const stationTypeSchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(300).optional().default(""),
  active: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).max(10000).optional().default(0),
});

const overrideSchema = z.object({
  controllerNumber: z.number().int().min(2).max(12),
  per30Min: z.number().min(0).max(1_000_000),
  perHour: z.number().min(0).max(1_000_000),
});

export const stationSchema = z.object({
  name: z.string().trim().min(1).max(40),
  typeId: objectId,
  description: z.string().trim().max(400).optional().default(""),
  sortOrder: z.number().int().min(0).max(10000).optional().default(0),
  maxControllers: z.number().int().min(1).max(12),
  operationalStatus: z.enum(["active", "disabled", "maintenance"]).optional().default("active"),
  pricing: z.object({
    per30Min: z.number().min(0).max(1_000_000),
    perHour: z.number().min(0).max(1_000_000),
    additionalPer30Min: z.number().min(0).max(1_000_000).optional().default(0),
    additionalPerHour: z.number().min(0).max(1_000_000).optional().default(0),
    controllerOverrides: z.array(overrideSchema).max(11).optional().default([]),
  }),
});

export const stationStatusSchema = z.object({
  operationalStatus: z.enum(["active", "disabled", "maintenance", "archived"]),
});

const scheduleFields = {
  startTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  startDate: day.nullable().optional(),
  endDate: day.nullable().optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7).optional().default([]),
  stationIds: z.array(objectId).max(200).optional().default([]),
  stationTypeIds: z.array(objectId).max(50).optional().default([]),
  priority: z.number().int().min(0).max(1000).optional().default(0),
  active: z.boolean().optional().default(true),
};

export const discountSchema = z.object({
  name: z.string().trim().min(1).max(80),
  type: z.enum(["percentage", "fixed"]),
  value: z.number().min(0).max(1_000_000),
  minDurationMinutes: z.number().int().min(0).max(24 * 60).nullable().optional(),
  ...scheduleFields,
}).superRefine((value, ctx) => {
  if (value.type === "percentage" && value.value > 100) {
    ctx.addIssue({ code: "custom", message: "Percentage discount cannot exceed 100.", path: ["value"] });
  }
  if (value.value <= 0) {
    ctx.addIssue({ code: "custom", message: "Discount value must be greater than zero.", path: ["value"] });
  }
});

export const pricingRuleSchema = z.object({
  name: z.string().trim().min(1).max(80),
  basePer30Min: z.number().min(0).max(1_000_000),
  basePerHour: z.number().min(0).max(1_000_000),
  additionalPer30Min: z.number().min(0).max(1_000_000).nullable().optional(),
  additionalPerHour: z.number().min(0).max(1_000_000).nullable().optional(),
  ...scheduleFields,
});

export const customerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(30).optional().default(""),
  email: z.string().trim().max(160).optional().default(""),
  notes: z.string().trim().max(2000).optional().default(""),
});

export const noticeSchema = z.object({
  audience: z.enum(["staff", "public"]),
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(2000),
});

export const noticeActiveSchema = z.object({
  active: z.boolean(),
});

export const paymentMethodSchema = z.enum([
  "cash",
  "card",
  "bank_transfer",
  "easypaisa",
  "jazzcash",
  "other",
]);

export const createBookingSchema = z.object({
  mode: z.enum(["walk_in", "reservation"]),
  customerName: z.string().trim().min(1).max(120),
  customerPhone: z.string().trim().max(30).optional().default(""),
  customerId: objectId.nullable().optional(),
  stationId: objectId,
  controllerCount: z.number().int().min(1).max(12),
  gamingDay: day.optional(),
  startTime: timeHm.optional(),
  durationMinutes: z.number().int().min(1).max(24 * 60),
  notes: z.string().trim().max(2000).optional().default(""),
  payment: z
    .object({
      amount: z.number().min(0).max(10_000_000),
      method: paymentMethodSchema,
      reference: z.string().trim().max(120).optional().default(""),
    })
    .nullable()
    .optional(),
});

export const quoteBookingSchema = createBookingSchema.pick({
  stationId: true,
  controllerCount: true,
  gamingDay: true,
  startTime: true,
  durationMinutes: true,
  mode: true,
});

export const updateBookingSchema = z.object({
  customerName: z.string().trim().min(1).max(120).optional(),
  customerPhone: z.string().trim().max(30).optional(),
  notes: z.string().trim().max(2000).optional(),
  controllerCount: z.number().int().min(1).max(12).optional(),
  stationId: objectId.optional(),
  gamingDay: day.optional(),
  startTime: timeHm.optional(),
  durationMinutes: z.number().int().min(1).max(24 * 60).optional(),
});

export const bookingActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("start"), force: z.boolean().optional() }),
  z.object({ type: z.literal("end") }),
  z.object({ type: z.literal("cancel"), reason: z.string().trim().max(500).optional().default("") }),
  z.object({ type: z.literal("no_show") }),
  z.object({ type: z.literal("extend"), minutes: z.number().int().min(1).max(24 * 60) }),
  z.object({ type: z.literal("reduce"), minutes: z.number().int().min(1).max(24 * 60) }),
  z.object({ type: z.literal("pause") }),
  z.object({ type: z.literal("resume"), preserveTime: z.boolean().optional().default(true) }),
]);

export const paymentSchema = z.object({
  bookingId: objectId,
  amount: z.number().positive().max(10_000_000),
  method: paymentMethodSchema,
  kind: z.enum(["payment", "refund"]).optional().default("payment"),
  reference: z.string().trim().max(120).optional().default(""),
  notes: z.string().trim().max(500).optional().default(""),
});

export const settingsSchema = z.object({
  business: z.object({
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().max(400).optional().default(""),
    logoDataUrl: z.string().max(700_000).optional().default(""),
    address: z.string().trim().max(300).optional().default(""),
    phone: z.string().trim().max(40).optional().default(""),
    whatsapp: z.string().trim().max(40).optional().default(""),
    email: z.string().trim().max(160).optional().default(""),
    mapsUrl: z.string().trim().max(500).optional().default(""),
    socials: z.object({
      facebook: z.string().trim().max(300).optional().default(""),
      instagram: z.string().trim().max(300).optional().default(""),
      tiktok: z.string().trim().max(300).optional().default(""),
      youtube: z.string().trim().max(300).optional().default(""),
    }),
  }),
  operatingHours: z.object({
    gamingDayStart: timeHm,
    gamingDayEnd: timeHm,
    timezone: z.string().trim().min(1).max(80),
  }),
  publicHours: z.object({
    start: timeHm,
    end: timeHm,
  }),
  booking: z.object({
    maxAdvanceDays: z.number().int().min(1).max(365),
    minDurationMinutes: z.number().int().min(5).max(24 * 60),
    maxDurationMinutes: z.number().int().min(5).max(24 * 60),
    durationStepMinutes: z.number().int().min(5).max(180),
    cancellationRequiresReason: z.boolean(),
    allowPause: z.boolean(),
    earlyStartMinutes: z.number().int().min(0).max(180),
  }),
  system: z.object({
    currency: z.string().trim().min(1).max(12),
    currencySymbol: z.string().trim().min(1).max(8),
    dateFormat: z.enum(["dd MMM yyyy", "yyyy-MM-dd", "dd/MM/yyyy"]),
    timeFormat: z.enum(["12h", "24h"]),
  }),
  pricingDefaults: z.object({
    per30Min: z.number().min(0).max(1_000_000),
    perHour: z.number().min(0).max(1_000_000),
    additionalPer30Min: z.number().min(0).max(1_000_000),
    additionalPerHour: z.number().min(0).max(1_000_000),
    maxControllers: z.number().int().min(1).max(12),
  }),
});

export const userSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(160),
  password: z.string().min(8).max(200).optional(),
  role: z.enum(["owner", "admin", "manager", "staff"]),
  active: z.boolean().optional().default(true),
});

export const productSchema = z.object({
  name: z.string().trim().min(1).max(80),
  sku: z.string().trim().min(1).max(40),
  category: z.string().trim().min(1).max(40),
  purchasePrice: z.number().min(0).max(1_000_000),
  sellingPrice: z.number().min(0).max(1_000_000),
  stockQuantity: z.number().int().min(0).max(1_000_000),
  minimumStock: z.number().int().min(0).max(1_000_000),
  active: z.boolean().optional().default(true),
});

export const stockAdjustSchema = z.object({
  delta: z.number().int().min(-100000).max(100000).refine((value) => value !== 0, "Enter a quantity."),
  note: z.string().trim().max(300).optional().default(""),
});

export const posOrderSchema = z.object({
  bookingId: objectId.nullable().optional(),
  items: z.array(z.object({
    productId: objectId,
    quantity: z.number().int().min(1).max(1000),
  })).min(1).max(50),
  discountAmount: z.number().min(0).max(1_000_000).optional().default(0),
  paymentMethod: paymentMethodSchema,
  notes: z.string().trim().max(500).optional().default(""),
});

export const contactSchema = z.object({
  name: z.string().trim().min(1).max(80),
  phone: z.string().trim().max(40).optional().default(""),
  message: z.string().trim().min(1).max(1000),
});

export function zodMessage(error: z.ZodError): string {
  return error.issues[0]?.message || "Check the form and try again.";
}
