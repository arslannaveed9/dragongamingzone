import mongoose, { Schema, type InferSchemaType, type Types } from "mongoose";

const blogPostSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },
    excerpt: { type: String, default: "", trim: true },
    body: { type: String, required: true },
    coverDataUrl: { type: String, default: "" },
    published: { type: Boolean, default: true },
    authorName: { type: String, default: "" },
    tags: { type: [String], default: [] },
    featured: { type: Boolean, default: false },
    readingMinutes: { type: Number, default: 1 },
    seoTitle: { type: String, default: "" },
    seoDescription: { type: String, default: "" },
  },
  { timestamps: true },
);

export type BlogPostDocument = InferSchemaType<typeof blogPostSchema> & { _id: Types.ObjectId; createdAt: Date };

export const BlogPost = mongoose.models.BlogPost || mongoose.model("BlogPost", blogPostSchema);

if (!BlogPost.schema.path("tags")) {
  BlogPost.schema.add({
    tags: { type: [String], default: [] },
    featured: { type: Boolean, default: false },
    readingMinutes: { type: Number, default: 1 },
    seoTitle: { type: String, default: "" },
    seoDescription: { type: String, default: "" },
  });
}
