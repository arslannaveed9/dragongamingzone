import Link from "next/link";
import { SiteHeader } from "@/components/public/site-header";
import { ShareBar } from "@/components/public/share-bar";
import type { BlogArticle, BlogListItem } from "@/services/blog-service";

function PostCard({ post }: { post: BlogListItem }) {
  return (
    <Link href={`/blog/${post.slug}`} className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card">
      {post.hasCover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/public/blog/${post.slug}/cover`} alt="" className="aspect-[16/8] w-full object-cover" />
      ) : null}
      <span className="flex flex-1 flex-col p-5">
        {post.tags.length > 0 ? <span className="text-xs font-semibold uppercase tracking-wide text-cyan-800 dark:text-cyan-300">{post.tags.join(" · ")}</span> : null}
        <span className="mt-2 font-heading text-2xl font-bold">{post.title}</span>
        <span className="mt-2 text-sm text-muted-foreground">{post.postedAt}{post.authorName ? ` · ${post.authorName}` : ""} · {post.readingMinutes} min read</span>
        {post.excerpt ? <span className="mt-3 text-muted-foreground">{post.excerpt}</span> : null}
      </span>
    </Link>
  );
}

export function BlogListView({ posts, tag, heading, intro }: { posts: BlogListItem[]; tag?: string; heading: string; intro: string }) {
  const tags = [...new Set(posts.flatMap((post) => post.tags))];
  const visible = tag ? posts.filter((post) => post.tags.includes(tag)) : posts;
  const featured = !tag ? visible.find((post) => post.featured) : undefined;
  const rest = featured ? visible.filter((post) => post.id !== featured.id) : visible;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:py-16">
        <p className="gz-kicker text-cyan-800 dark:text-cyan-300">Blog</p>
        <h1 className="gz-title">{heading}</h1>
        <p className="mt-2 max-w-2xl text-base text-muted-foreground">{intro}</p>
        {tags.length > 0 ? (
          <div className="mt-6 flex gap-2 overflow-x-auto">
            <Link href="/blog" className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${tag ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"}`}>All</Link>
            {tags.map((item) => (
              <Link key={item} href={`/blog?tag=${encodeURIComponent(item)}`} className={`shrink-0 rounded-full px-3 py-1.5 text-sm capitalize ${tag === item ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{item}</Link>
            ))}
          </div>
        ) : null}
        {featured ? (
          <div className="mt-8">
            <PostCard post={featured} />
          </div>
        ) : null}
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {rest.map((post) => <PostCard key={post.id} post={post} />)}
        </div>
        {visible.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-dashed border-border px-6 py-12 text-center text-muted-foreground">{tag ? `No posts tagged ${tag}.` : "No posts yet."}</p>
        ) : null}
      </main>
    </div>
  );
}

export function BlogPostView({ post }: { post: BlogArticle | null }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
        <Link href="/blog" className="text-sm font-medium text-cyan-800 underline-offset-2 hover:underline dark:text-cyan-300">All posts</Link>
        {post ? (
          <article className="mt-6">
            {post.tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <Link key={tag} href={`/blog?tag=${encodeURIComponent(tag)}`} className="rounded-full bg-muted px-3 py-1 text-sm capitalize text-muted-foreground">{tag}</Link>
                ))}
              </div>
            ) : null}
            <h1 className="mt-4 font-heading text-4xl font-bold sm:text-5xl">{post.title}</h1>
            <p className="mt-3 text-sm text-muted-foreground">{post.postedAt}{post.authorName ? ` · ${post.authorName}` : ""} · {post.readingMinutes} min read</p>
            {post.excerpt ? <p className="mt-4 text-lg text-muted-foreground">{post.excerpt}</p> : null}
            {post.hasCover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/public/blog/${post.slug}/cover`} alt="" className="mt-6 aspect-[16/8] w-full rounded-2xl object-cover" />
            ) : null}
            <div className="mt-8 whitespace-pre-wrap text-base leading-relaxed">{post.body}</div>
            <ShareBar title={post.title} />
            {post.related.length > 0 ? (
              <section className="mt-12">
                <h2 className="font-heading text-2xl font-bold">More from the zone</h2>
                <div className="mt-4 grid gap-4">
                  {post.related.map((item) => <PostCard key={item.id} post={item} />)}
                </div>
              </section>
            ) : null}
          </article>
        ) : (
          <div className="mt-8">
            <h1 className="gz-title">Post not found</h1>
            <p className="mt-2 text-muted-foreground">That post is unpublished or no longer here.</p>
          </div>
        )}
      </main>
    </div>
  );
}
