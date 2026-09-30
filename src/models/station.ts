import mongoose, { Schema, type InferSchemaType, type Types } from "mongoose";

const overrideSchema = new Schema(
  {
    controllerNumber: { type: Number, required: true },
    per30Min: { type: Number, required: true, min: 0 },
    perHour: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const stationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    typeId: { type: Schema.Types.ObjectId, ref: "StationType", required: true, index: true },
    description: { type: String, default: "" },
    operationalStatus: {
      type: String,
      enum: ["active", "disabled", "maintenance", "archived"],
      default: "active",
      index: true,
    },
    sortOrder: { type: Number, default: 0 },
    maxControllers: { type: Number, default: 4, min: 1, max: 12 },
    pricing: {
      per30Min: { type: Number, required: true, min: 0 },
      perHour: { type: Number, required: true, min: 0 },
      additionalPer30Min: { type: Number, default: 0, min: 0 },
      additionalPerHour: { type: Number, default: 0, min: 0 },
      controllerOverrides: { type: [overrideSchema], default: [] },
    },
    lockToken: { type: String, default: null },
    lockedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

stationSchema.index({ operationalStatus: 1, sortOrder: 1, name: 1 });

export type StationDocument = InferSchemaType<typeof stationSchema> & { _id: Types.ObjectId };
export const Station = mongoose.models.Station || mongoose.model("Station", stationSchema);
