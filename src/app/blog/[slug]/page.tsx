import { cache } from "react";
import { BlogPostView } from "@/components/public/blog-view";
import { pageMetadata, siteName } from "@/lib/seo";
import { getPublishedBlog } from "@/services/blog-service";
import { getSettings } from "@/services/settings-service";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ slug: string }> };

const loadPost = cache(async (slug: string) => getPublishedBlog(decodeURIComponent(slug)));

export async function generateMetadata({ params }: Context) {
  const { slug } = await params;
  const [settings, post] = await Promise.all([getSettings(), loadPost(slug)]);
  if (!post) return pageMetadata(settings, { title: "Post not found", path: `/blog/${slug}`, noindex: true });
  return pageMetadata(settings, {
    title: post.seoTitle || post.title,
    description: post.seoDescription || post.excerpt || post.title,
    path: `/blog/${post.slug}`,
    image: post.hasCover ? `/api/public/blog/${post.slug}/cover` : undefined,
    type: "article",
  });
}

export default async function BlogArticlePage({ params }: Context) {
  const { slug } = await params;
  const [settings, post] = await Promise.all([getSettings(), loadPost(slug)]);
  const jsonLd = post
    ? {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: post.seoTitle || post.title,
        description: post.seoDescription || post.excerpt,
        author: { "@type": "Person", name: post.authorName || siteName(settings) },
        datePublished: post.postedAt,
        keywords: post.tags.join(", "),
      }
    : null;
  return (
    <>
      {jsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /> : null}
      <BlogPostView post={post} />
    </>
  );
}
