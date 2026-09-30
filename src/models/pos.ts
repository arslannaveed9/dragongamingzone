import mongoose, { Schema, type InferSchemaType, type Types } from "mongoose";

const itemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

/**
 * A POS order can stand alone or attach to a booking via bookingId.
 * Combined billing reads gaming charges from the booking and these lines
 * without changing the booking price snapshot.
 */
const posOrderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking", default: null, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", default: null },
    items: { type: [itemSchema], required: true },
    discountAmount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    paymentMethod: { type: String, required: true },
    paymentStatus: { type: String, enum: ["paid", "refunded"], default: "paid" },
    gamingDay: { type: String, required: true, index: true },
    notes: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    createdByName: { type: String, required: true },
  },
  { timestamps: true },
);

export type PosOrderDocument = InferSchemaType<typeof posOrderSchema> & { _id: Types.ObjectId; createdAt: Date };
export const PosOrder = mongoose.models.PosOrder || mongoose.model("PosOrder", posOrderSchema);

const lineSchema = new Schema(
  {
    kind: { type: String, enum: ["gaming", "product"], required: true },
    description: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    total: { type: Number, required: true },
    refType: { type: String, default: "" },
    refId: { type: String, default: "" },
  },
  { _id: false },
);

/** Future single invoice that can mix a gaming session and product lines. */
const billSchema = new Schema(
  {
    bookingIds: { type: [Schema.Types.ObjectId], ref: "Booking", default: [] },
    posOrderIds: { type: [Schema.Types.ObjectId], ref: "PosOrder", default: [] },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", default: null },
    lines: { type: [lineSchema], default: [] },
    total: { type: Number, required: true },
    currency: { type: String, required: true },
    status: { type: String, enum: ["open", "settled", "void"], default: "open" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

export const Bill = mongoose.models.Bill || mongoose.model("Bill", billSchema);
