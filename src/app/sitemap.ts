import type { MetadataRoute } from "next";
import { BlogPost } from "@/models/blog-post";
import { Tournament } from "@/models/tournament";
import { siteOrigin } from "@/lib/seo";
import { connectDB } from "@/lib/mongodb";
import { getSettings } from "@/services/settings-service";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const settings = await getSettings();
  const origin = siteOrigin(settings);
  if (!origin || !settings.seo.index) return [];
  await connectDB();
  const [posts, tournaments] = await Promise.all([
    BlogPost.find({ published: true }).select("slug updatedAt").lean<{ slug: string; updatedAt?: Date }[]>(),
    Tournament.find({ published: true, cancelled: { $ne: true } }).select("slug updatedAt").lean<{ slug: string; updatedAt?: Date }[]>(),
  ]);
  const pages = ["/", "/blog", "/notices", "/tournaments"].map((path) => ({ url: `${origin}${path}`, lastModified: new Date() }));
  return [
    ...pages,
    ...posts.map((post) => ({
      url: `${origin}/blog/${post.slug}`,
      lastModified: post.updatedAt ? new Date(post.updatedAt) : new Date(),
    })),
    ...tournaments.map((item) => ({
      url: `${origin}/tournaments/${item.slug}`,
      lastModified: item.updatedAt ? new Date(item.updatedAt) : new Date(),
    })),
  ];
}
