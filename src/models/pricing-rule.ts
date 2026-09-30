import mongoose, { Schema, type InferSchemaType, type Types } from "mongoose";

const pricingRuleSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    active: { type: Boolean, default: true, index: true },
    priority: { type: Number, default: 0 },
    stationIds: { type: [Schema.Types.ObjectId], ref: "Station", default: [] },
    stationTypeIds: { type: [Schema.Types.ObjectId], ref: "StationType", default: [] },
    daysOfWeek: { type: [Number], default: [] },
    startTime: { type: String, default: null },
    endTime: { type: String, default: null },
    startDate: { type: String, default: null },
    endDate: { type: String, default: null },
    basePer30Min: { type: Number, required: true, min: 0 },
    basePerHour: { type: Number, required: true, min: 0 },
    additionalPer30Min: { type: Number, default: null },
    additionalPerHour: { type: Number, default: null },
    kind: { type: String, enum: ["special", "promotional"], default: "special" },
  },
  { timestamps: true },
);

export type PricingRuleDocument = InferSchemaType<typeof pricingRuleSchema> & { _id: Types.ObjectId };
export const PricingRule =
  mongoose.models.PricingRule || mongoose.model("PricingRule", pricingRuleSchema);
