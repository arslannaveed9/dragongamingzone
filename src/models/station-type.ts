import mongoose, { Schema, type InferSchemaType, type Types } from "mongoose";

const stationTypeSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, default: "" },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true },
);

stationTypeSchema.index({ active: 1, sortOrder: 1 });

export type StationTypeDocument = InferSchemaType<typeof stationTypeSchema> & { _id: Types.ObjectId };
export const StationType =
  mongoose.models.StationType || mongoose.model("StationType", stationTypeSchema);
