import mongoose, { Schema, type InferSchemaType, type Types } from "mongoose";

const galleryPhotoSchema = new Schema(
  {
    dataUrl: { type: String, required: true },
    caption: { type: String, default: "", trim: true },
    sort: { type: Number, required: true },
  },
  { timestamps: true },
);

galleryPhotoSchema.index({ sort: 1, createdAt: 1 });

export type GalleryPhotoDocument = InferSchemaType<typeof galleryPhotoSchema> & { _id: Types.ObjectId };

export const GalleryPhoto = mongoose.models.GalleryPhoto || mongoose.model("GalleryPhoto", galleryPhotoSchema);
