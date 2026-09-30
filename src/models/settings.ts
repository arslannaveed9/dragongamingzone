import mongoose, { Schema, type InferSchemaType, type Types } from "mongoose";

const settingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "default" },
    business: {
      name: { type: String, default: "Dragon Gaming Zone" },
      description: { type: String, default: "" },
      logoDataUrl: { type: String, default: "" },
      address: { type: String, default: "" },
      phone: { type: String, default: "" },
      whatsapp: { type: String, default: "" },
      email: { type: String, default: "" },
      mapsUrl: { type: String, default: "" },
      socials: {
        facebook: { type: String, default: "" },
        instagram: { type: String, default: "" },
        tiktok: { type: String, default: "" },
        youtube: { type: String, default: "" },
      },
    },
    operatingHours: {
      gamingDayStart: { type: String, default: "09:00" },
      gamingDayEnd: { type: String, default: "03:00" },
      timezone: { type: String, default: "Asia/Karachi" },
    },
    publicHours: {
      start: { type: String, default: "" },
      end: { type: String, default: "" },
    },
    booking: {
      maxAdvanceDays: { type: Number, default: 60 },
      minDurationMinutes: { type: Number, default: 30 },
      maxDurationMinutes: { type: Number, default: 720 },
      durationStepMinutes: { type: Number, default: 30 },
      cancellationRequiresReason: { type: Boolean, default: true },
      allowPause: { type: Boolean, default: true },
      earlyStartMinutes: { type: Number, default: 15 },
    },
    system: {
      currency: { type: String, default: "PKR" },
      currencySymbol: { type: String, default: "Rs" },
      dateFormat: { type: String, default: "dd MMM yyyy" },
      timeFormat: { type: String, default: "12h" },
    },
    pricingDefaults: {
      per30Min: { type: Number, default: 0 },
      perHour: { type: Number, default: 0 },
      additionalPer30Min: { type: Number, default: 0 },
      additionalPerHour: { type: Number, default: 0 },
      maxControllers: { type: Number, default: 4 },
    },
    figuresPasswordHash: { type: String, default: "", select: false },
  },
  { timestamps: true },
);

export type SettingsDocument = InferSchemaType<typeof settingsSchema> & { _id: Types.ObjectId };
export const BusinessSettings =
  mongoose.models.BusinessSettings || mongoose.model("BusinessSettings", settingsSchema);

if (!BusinessSettings.schema.path("publicHours")) {
  BusinessSettings.schema.add({
    publicHours: {
      start: { type: String, default: "" },
      end: { type: String, default: "" },
    },
  });
}
