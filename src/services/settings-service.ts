import { AppError } from "@/lib/errors";
import { hashPassword, verifyPassword } from "@/lib/password";
import { isValidTimezone, parseHm, type OperatingHours } from "@/lib/gaming-day";
import { emptySeo, type SeoSettings } from "@/lib/seo";
import { connectDB } from "@/lib/mongodb";
import { BusinessSettings } from "@/models/settings";
import { writeAudit } from "@/services/audit-service";
import type { Actor } from "@/services/auth-service";

export type AppSettings = {
  business: {
    name: string;
    description: string;
    logoDataUrl: string;
    address: string;
    phone: string;
    whatsapp: string;
    email: string;
    mapsUrl: string;
    socials: { facebook: string; instagram: string; tiktok: string; youtube: string };
  };
  operatingHours: OperatingHours;
  publicHours: { start: string; end: string };
  booking: {
    maxAdvanceDays: number;
    minDurationMinutes: number;
    maxDurationMinutes: number;
    durationStepMinutes: number;
    cancellationRequiresReason: boolean;
    allowPause: boolean;
    earlyStartMinutes: number;
  };
  system: {
    currency: string;
    currencySymbol: string;
    dateFormat: "dd MMM yyyy" | "yyyy-MM-dd" | "dd/MM/yyyy";
    timeFormat: "12h" | "24h";
  };
  pricingDefaults: {
    per30Min: number;
    perHour: number;
    additionalPer30Min: number;
    additionalPerHour: number;
    maxControllers: number;
  };
  seo: SeoSettings;
};

function plain(doc: { toObject?: () => Record<string, unknown> } & Record<string, unknown>): AppSettings {
  const value = (doc.toObject ? doc.toObject() : doc) as AppSettings;
  return {
    business: {
      name: value.business?.name || "Dragon Gaming Zone",
      description: value.business?.description || "",
      logoDataUrl: value.business?.logoDataUrl || "",
      address: value.business?.address || "",
      phone: value.business?.phone || "",
      whatsapp: value.business?.whatsapp || "",
      email: value.business?.email || "",
      mapsUrl: value.business?.mapsUrl || "",
      socials: {
        facebook: value.business?.socials?.facebook || "",
        instagram: value.business?.socials?.instagram || "",
        tiktok: value.business?.socials?.tiktok || "",
        youtube: value.business?.socials?.youtube || "",
      },
    },
    operatingHours: {
      gamingDayStart: value.operatingHours?.gamingDayStart || "09:00",
      gamingDayEnd: value.operatingHours?.gamingDayEnd || "03:00",
      timezone: value.operatingHours?.timezone || "Asia/Karachi",
    },
    publicHours: {
      start: value.publicHours?.start || value.operatingHours?.gamingDayStart || "09:00",
      end: value.publicHours?.end || value.operatingHours?.gamingDayEnd || "03:00",
    },
    booking: {
      maxAdvanceDays: value.booking?.maxAdvanceDays ?? 60,
      minDurationMinutes: value.booking?.minDurationMinutes ?? 30,
      maxDurationMinutes: value.booking?.maxDurationMinutes ?? 720,
      durationStepMinutes: value.booking?.durationStepMinutes ?? 30,
      cancellationRequiresReason: value.booking?.cancellationRequiresReason ?? true,
      allowPause: value.booking?.allowPause ?? true,
      earlyStartMinutes: value.booking?.earlyStartMinutes ?? 15,
    },
    system: {
      currency: value.system?.currency || "PKR",
      currencySymbol: value.system?.currencySymbol || "Rs",
      dateFormat: value.system?.dateFormat || "dd MMM yyyy",
      timeFormat: value.system?.timeFormat || "12h",
    },
    pricingDefaults: {
      per30Min: value.pricingDefaults?.per30Min ?? 0,
      perHour: value.pricingDefaults?.perHour ?? 0,
      additionalPer30Min: value.pricingDefaults?.additionalPer30Min ?? 0,
      additionalPerHour: value.pricingDefaults?.additionalPerHour ?? 0,
      maxControllers: value.pricingDefaults?.maxControllers ?? 4,
    },
    seo: {
      ...emptySeo(),
      ...value.seo,
      siteUrl: value.seo?.siteUrl || "",
      title: value.seo?.title || "",
      description: value.seo?.description || "",
      keywords: value.seo?.keywords || "",
      googleVerification: value.seo?.googleVerification || "",
      index: value.seo?.index !== false,
      homeTitle: value.seo?.homeTitle || "",
      homeDescription: value.seo?.homeDescription || "",
      blogTitle: value.seo?.blogTitle || "",
      blogDescription: value.seo?.blogDescription || "",
      noticesTitle: value.seo?.noticesTitle || "",
      noticesDescription: value.seo?.noticesDescription || "",
      tournamentsTitle: value.seo?.tournamentsTitle || "",
      tournamentsDescription: value.seo?.tournamentsDescription || "",
      ogImageDataUrl: value.seo?.ogImageDataUrl || "",
    },
  };
}

export async function getSettings(): Promise<AppSettings> {
  await connectDB();
  const existing = await BusinessSettings.findOne({ key: "default" });
  if (existing) return plain(existing as never);
  const created = await BusinessSettings.create({ key: "default" });
  return plain(created as never);
}

export function validateSettings(input: AppSettings) {
  if (!isValidTimezone(input.operatingHours.timezone)) {
    throw new AppError(400, "TIMEZONE", "Enter a valid IANA timezone, such as Asia/Karachi.");
  }
  const start = parseHm(input.operatingHours.gamingDayStart);
  const end = parseHm(input.operatingHours.gamingDayEnd);
  if (start === end) {
    throw new AppError(400, "HOURS", "Gaming day start and end cannot be the same time.");
  }
  if (parseHm(input.publicHours.start) === parseHm(input.publicHours.end)) {
    throw new AppError(400, "HOURS", "Website opening and closing times cannot be the same.");
  }
  if (input.booking.minDurationMinutes > input.booking.maxDurationMinutes) {
    throw new AppError(400, "DURATION", "Minimum duration cannot exceed maximum duration.");
  }
  if (input.booking.minDurationMinutes % input.booking.durationStepMinutes !== 0) {
    throw new AppError(400, "DURATION", "Minimum duration must match the duration step.");
  }
  if (input.business.logoDataUrl && !input.business.logoDataUrl.startsWith("data:image/")) {
    throw new AppError(400, "LOGO", "Logo must be an image file.");
  }
  if (input.seo.siteUrl && !/^https?:\/\/.+/i.test(input.seo.siteUrl)) {
    throw new AppError(400, "SEO", "The public site URL must start with http:// or https://.");
  }
  if (input.seo.ogImageDataUrl && !input.seo.ogImageDataUrl.startsWith("data:image/")) {
    throw new AppError(400, "SEO", "The share image must be an image file.");
  }
}

export async function updateSettings(input: AppSettings, actor: Actor) {
  validateSettings(input);
  const previous = await getSettings();
  await BusinessSettings.updateOne({ key: "default" }, { $set: input }, { upsert: true });
  const next = await getSettings();
  const { logoDataUrl: previousLogo, ...previousBusiness } = previous.business;
  const { logoDataUrl: nextLogo, ...nextBusiness } = next.business;
  const { ogImageDataUrl: previousOg, ...previousSeo } = previous.seo;
  const { ogImageDataUrl: nextOg, ...nextSeo } = next.seo;
  await writeAudit({
    actor,
    action: "settings.updated",
    entity: "settings",
    entityId: "default",
    oldValue: {
      ...previous,
      business: { ...previousBusiness, logoChanged: Boolean(previousLogo) },
      seo: { ...previousSeo, ogImageChanged: Boolean(previousOg) },
    },
    newValue: {
      ...next,
      business: { ...nextBusiness, logoChanged: previousLogo !== nextLogo },
      seo: { ...nextSeo, ogImageChanged: previousOg !== nextOg },
    },
  });
  return next;
}

export function publicSettings(settings: AppSettings) {
  return settings;
}

export async function figuresPasswordConfigured(): Promise<boolean> {
  await connectDB();
  const doc = await BusinessSettings.collection.findOne({ key: "default" }, { projection: { figuresPasswordHash: 1 } });
  return Boolean(doc?.figuresPasswordHash);
}

export async function setFiguresPassword(password: string, actor: Actor) {
  if (actor.role !== "owner") {
    throw new AppError(403, "FORBIDDEN", "Only the owner can set the figures password.");
  }
  await getSettings();
  const figuresPasswordHash = await hashPassword(password);
  await BusinessSettings.collection.updateOne({ key: "default" }, { $set: { figuresPasswordHash } });
  await writeAudit({
    actor,
    action: "settings.updated",
    entity: "settings",
    entityId: "default",
    newValue: { figuresPasswordChanged: true },
  });
}

export async function checkFiguresPassword(password: string) {
  await connectDB();
  const doc = await BusinessSettings.collection.findOne({ key: "default" }, { projection: { figuresPasswordHash: 1 } });
  if (!doc?.figuresPasswordHash) {
    throw new AppError(400, "FIGURES", "The owner has not set a figures password yet.");
  }
  const matches = await verifyPassword(password, doc.figuresPasswordHash);
  if (!matches) throw new AppError(400, "FIGURES", "That password is incorrect.");
}
