import mongoose, { Schema, type InferSchemaType, type Types } from "mongoose";

const paymentSchema = new Schema(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking", default: null, index: true },
    billId: { type: Schema.Types.ObjectId, ref: "Bill", default: null },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", default: null },
    amount: { type: Number, required: true, min: 0 },
    kind: { type: String, enum: ["payment", "refund"], default: "payment" },
    method: {
      type: String,
      enum: ["cash", "card", "bank_transfer", "easypaisa", "jazzcash", "other"],
      required: true,
    },
    reference: { type: String, default: "" },
    notes: { type: String, default: "" },
    gamingDay: { type: String, required: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    recordedByName: { type: String, required: true },
  },
  { timestamps: true },
);

paymentSchema.index({ gamingDay: 1, createdAt: -1 });

export type PaymentDocument = InferSchemaType<typeof paymentSchema> & { _id: Types.ObjectId; createdAt: Date };
export const Payment = mongoose.models.Payment || mongoose.model("Payment", paymentSchema);
