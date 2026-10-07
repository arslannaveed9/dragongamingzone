import mongoose, { Schema, type InferSchemaType, type Types } from "mongoose";

const loginSessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    userAgent: { type: String, default: "" },
    ip: { type: String, default: "" },
  },
  { timestamps: true },
);

loginSessionSchema.index({ userId: 1, revokedAt: 1, expiresAt: 1 });

export type LoginSessionDocument = InferSchemaType<typeof loginSessionSchema> & { _id: Types.ObjectId };

export const LoginSession = mongoose.models.LoginSession || mongoose.model("LoginSession", loginSessionSchema);
