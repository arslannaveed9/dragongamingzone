import mongoose, { Schema, type InferSchemaType, type Types } from "mongoose";

const inquirySchema = new Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, default: "" },
    message: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type InquiryDocument = InferSchemaType<typeof inquirySchema> & { _id: Types.ObjectId; createdAt: Date };
export const ContactInquiry =
  mongoose.models.ContactInquiry || mongoose.model("ContactInquiry", inquirySchema);
