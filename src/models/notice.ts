import mongoose, { Schema, type InferSchemaType, type Types } from "mongoose";

const noticeSchema = new Schema(
  {
    audience: { type: String, enum: ["staff", "public"], required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    active: { type: Boolean, default: true },
    authorName: { type: String, default: "" },
  },
  { timestamps: true },
);

export type NoticeDocument = InferSchemaType<typeof noticeSchema> & { _id: Types.ObjectId; createdAt: Date };
export const Notice = mongoose.models.Notice || mongoose.model("Notice", noticeSchema);
