import mongoose, { Schema, type InferSchemaType, type Types } from "mongoose";

const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, unique: true, trim: true },
    category: { type: String, required: true, trim: true, index: true },
    purchasePrice: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    stockQuantity: { type: Number, required: true, min: 0, default: 0 },
    minimumStock: { type: Number, required: true, min: 0, default: 0 },
    active: { type: Boolean, default: true },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export type ProductDocument = InferSchemaType<typeof productSchema> & { _id: Types.ObjectId };
export const Product = mongoose.models.Product || mongoose.model("Product", productSchema);

const movementSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    delta: { type: Number, required: true },
    reason: { type: String, enum: ["sale", "adjustment", "receive"], required: true },
    orderId: { type: Schema.Types.ObjectId, ref: "PosOrder", default: null },
    note: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const StockMovement =
  mongoose.models.StockMovement || mongoose.model("StockMovement", movementSchema);
