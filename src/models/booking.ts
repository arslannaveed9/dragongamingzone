import mongoose, { Schema, type InferSchemaType, type Types } from "mongoose";

const bookingSchema = new Schema(
  {
    bookingNumber: { type: String, required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", default: null, index: true },
    customerName: { type: String, required: true },
    customerNameLower: { type: String, default: "", index: true },
    customerPhone: { type: String, default: "", index: true },
    stationId: { type: Schema.Types.ObjectId, ref: "Station", required: true },
    stationName: { type: String, required: true },
    stationTypeId: { type: Schema.Types.ObjectId, ref: "StationType", required: true },
    stationTypeName: { type: String, required: true },
    gamingDay: { type: String, required: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    durationMinutes: { type: Number, required: true },
    controllerCount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["scheduled", "active", "completed", "cancelled", "no_show"],
      required: true,
      index: true,
    },
    pausedAt: { type: Date, default: null },
    pausedMs: { type: Number, default: 0 },
    source: { type: String, enum: ["walk_in", "reservation", "backdated"], required: true },
    pricing: {
      baseAmount: { type: Number, required: true },
      controllerAmount: { type: Number, required: true },
      discountAmount: { type: Number, required: true },
      subtotal: { type: Number, required: true },
      finalAmount: { type: Number, required: true },
      currency: { type: String, required: true },
      appliedDiscountId: { type: Schema.Types.ObjectId, default: null },
      appliedDiscountName: { type: String, default: "" },
      appliedRuleId: { type: Schema.Types.ObjectId, default: null },
      appliedRuleName: { type: String, default: "" },
      breakdown: { type: Schema.Types.Mixed, default: {} },
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "partial", "paid", "refunded"],
      default: "unpaid",
    },
    amountPaid: { type: Number, default: 0 },
    notes: { type: String, default: "" },
    cancelReason: { type: String, default: "" },
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    completedAt: { type: Date, default: null },
    autoCompleted: { type: Boolean, default: false },
    noShowAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    createdByName: { type: String, required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedByName: { type: String, default: "" },
  },
  { timestamps: true },
);

bookingSchema.index({ stationId: 1, startAt: 1, endAt: 1 });
bookingSchema.index({ stationId: 1, status: 1, startAt: 1 });
bookingSchema.index({ gamingDay: 1, status: 1 });
bookingSchema.index({ status: 1, endAt: 1 });
bookingSchema.index({ customerId: 1, startAt: -1 });
bookingSchema.index({ createdAt: -1 });

export type BookingDocument = InferSchemaType<typeof bookingSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};
export const Booking = mongoose.models.Booking || mongoose.model("Booking", bookingSchema);
