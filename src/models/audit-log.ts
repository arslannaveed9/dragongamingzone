import mongoose, { Schema, type InferSchemaType, type Types } from "mongoose";

const auditSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    userName: { type: String, default: "" },
    action: { type: String, required: true, index: true },
    entity: { type: String, required: true },
    entityId: { type: String, required: true },
    oldValue: { type: Schema.Types.Mixed, default: null },
    newValue: { type: Schema.Types.Mixed, default: null },
    metadata: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditSchema.index({ createdAt: -1 });
auditSchema.index({ entity: 1, entityId: 1, createdAt: -1 });

export type AuditDocument = InferSchemaType<typeof auditSchema> & { _id: Types.ObjectId; createdAt: Date };
export const AuditLog = mongoose.models.AuditLog || mongoose.model("AuditLog", auditSchema);
