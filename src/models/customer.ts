import mongoose, { Schema, type InferSchemaType, type Types } from "mongoose";

const customerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true },
    notes: { type: String, default: "" },
    archived: { type: Boolean, default: false },
    stats: {
      totalBookings: { type: Number, default: 0 },
      totalMinutes: { type: Number, default: 0 },
      totalSpent: { type: Number, default: 0 },
      firstVisitAt: { type: Date, default: null },
      lastVisitAt: { type: Date, default: null },
    },
  },
  { timestamps: true },
);

customerSchema.index(
  { phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $type: "string", $gt: "" } } },
);
customerSchema.index({ name: 1 });
customerSchema.index({ archived: 1, name: 1 });

export type CustomerDocument = InferSchemaType<typeof customerSchema> & { _id: Types.ObjectId };
export const Customer = mongoose.models.Customer || mongoose.model("Customer", customerSchema);
