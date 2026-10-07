import { BlogListView } from "@/components/public/blog-view";
import { pageMetadata, siteDescription } from "@/lib/seo";
import { listBlogs } from "@/services/blog-service";
import { getSettings } from "@/services/settings-service";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const settings = await getSettings();
  return pageMetadata(settings, {
    title: settings.seo.blogTitle || "Blog",
    description: settings.seo.blogDescription || siteDescription(settings),
    path: "/blog",
  });
}

export default async function BlogPage({ searchParams }: { searchParams: Promise<{ tag?: string }> }) {
  const { tag } = await searchParams;
  const settings = await getSettings();
  const posts = await listBlogs(true);
  return (
    <BlogListView
      posts={posts}
      tag={tag?.trim().toLowerCase() || undefined}
      heading={settings.seo.blogTitle || "From the zone"}
      intro={settings.seo.blogDescription || "Stories, tournaments, and news from the floor."}
    />
  );
}
