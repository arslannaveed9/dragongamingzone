import mongoose, { Schema, type InferSchemaType, type Types } from "mongoose";

const schedule = {
  startTime: { type: String, default: null },
  endTime: { type: String, default: null },
  startDate: { type: String, default: null },
  endDate: { type: String, default: null },
  daysOfWeek: { type: [Number], default: [] },
  stationIds: { type: [Schema.Types.ObjectId], ref: "Station", default: [] },
  stationTypeIds: { type: [Schema.Types.ObjectId], ref: "StationType", default: [] },
  priority: { type: Number, default: 0 },
  active: { type: Boolean, default: true, index: true },
};

const discountSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ["percentage", "fixed"], required: true },
    value: { type: Number, required: true, min: 0 },
    minDurationMinutes: { type: Number, default: null },
    ...schedule,
  },
  { timestamps: true },
);

export type DiscountDocument = InferSchemaType<typeof discountSchema> & { _id: Types.ObjectId };
export const Discount = mongoose.models.Discount || mongoose.model("Discount", discountSchema);
