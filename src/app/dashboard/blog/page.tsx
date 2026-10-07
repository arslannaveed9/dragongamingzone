"use client";

import { useState } from "react";
import { ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, notifyRefresh, usePoll } from "@/components/admin/client";

type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  published: boolean;
  authorName: string;
  hasCover: boolean;
  postedAt: string;
  tags: string[];
  featured: boolean;
  readingMinutes: number;
};

type Draft = {
  id: string | null;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  authorName: string;
  tags: string;
  featured: boolean;
  seoTitle: string;
  seoDescription: string;
  published: boolean;
  coverDataUrl?: string;
  hasCover: boolean;
};

const empty: Draft = {
  id: null,
  title: "",
  slug: "",
  excerpt: "",
  body: "",
  authorName: "",
  tags: "",
  featured: false,
  seoTitle: "",
  seoDescription: "",
  published: true,
  hasCover: false,
};

function slugify(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

async function prepareCover(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose a JPG, PNG, or WebP photo.");
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error("Could not read that photo.");
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not read that photo.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
  if (dataUrl.length > 1_400_000) throw new Error("That photo is still too large. Try a smaller one.");
  return dataUrl;
}

export default function BlogAdminPage() {
  const { data, reload } = usePoll<Post[]>("/api/blog");
  const [draft, setDraft] = useState<Draft>(empty);
  const [slugEdited, setSlugEdited] = useState(false);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);

  function startNew() {
    setDraft(empty);
    setSlugEdited(false);
    setPreview("");
  }

  async function edit(post: Post) {
    try {
      const full = await api<Post & { body: string; seoTitle: string; seoDescription: string }>(`/api/blog/${post.id}`);
      setDraft({
        id: post.id,
        title: full.title,
        slug: full.slug,
        excerpt: full.excerpt,
        body: full.body,
        authorName: full.authorName,
        tags: (full.tags || []).join(", "),
        featured: full.featured,
        seoTitle: full.seoTitle || "",
        seoDescription: full.seoDescription || "",
        published: full.published,
        hasCover: full.hasCover,
      });
      setSlugEdited(true);
      setPreview("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open that post.");
    }
  }

  async function save() {
    if (!draft.title.trim() || !draft.body.trim()) {
      toast.error("Add a title and the post.");
      return;
    }
    setBusy(true);
    try {
      const payload: {
        title: string;
        slug: string;
        excerpt: string;
        body: string;
        authorName: string;
        tags: string[];
        featured: boolean;
        seoTitle: string;
        seoDescription: string;
        published: boolean;
        coverDataUrl?: string;
      } = {
        title: draft.title.trim(),
        slug: draft.slug.trim(),
        excerpt: draft.excerpt.trim(),
        body: draft.body.trim(),
        authorName: draft.authorName.trim(),
        tags: draft.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        featured: draft.featured,
        seoTitle: draft.seoTitle.trim(),
        seoDescription: draft.seoDescription.trim(),
        published: draft.published,
      };
      if (draft.coverDataUrl !== undefined) payload.coverDataUrl = draft.coverDataUrl;
      if (draft.id) {
        await api(`/api/blog/${draft.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        toast.success(draft.published ? "Post updated." : "Draft saved.");
      } else {
        await api("/api/blog", { method: "POST", body: JSON.stringify(payload) });
        toast.success(draft.published ? "Post is on the blog." : "Draft saved.");
        startNew();
      }
      notifyRefresh();
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the post.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(post: Post) {
    try {
      await api(`/api/blog/${post.id}`, { method: "DELETE" });
      if (draft.id === post.id) startNew();
      toast.success("Post deleted.");
      notifyRefresh();
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the post.");
    }
  }

  const coverSrc = preview || (draft.id && draft.hasCover && draft.coverDataUrl !== "" ? `/api/blog/${draft.id}/cover` : "");

  return (
    <div className="space-y-5">
      <div>
        <p className="gz-kicker text-cyan-800 dark:text-cyan-200">Website</p>
        <h1 className="gz-title">Blog</h1>
        <p className="mt-2 max-w-3xl text-base text-muted-foreground">Write the post, choose tags, pin one as featured, and set the search title. Published posts appear on the public blog. Drafts stay here.</p>
      </div>

      <section className="gz-panel space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading text-lg font-semibold">{draft.id ? "Edit post" : "New post"}</h2>
          {draft.id ? <Button type="button" variant="outline" size="sm" onClick={startNew}>New post</Button> : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="blog-title">Title</Label>
          <Input id="blog-title" value={draft.title} placeholder="Friday night tournament" onChange={(event) => setDraft({ ...draft, title: event.target.value, slug: slugEdited ? draft.slug : slugify(event.target.value) })} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="blog-slug">Link</Label>
            <Input id="blog-slug" value={draft.slug} placeholder="friday-night-tournament" onChange={(event) => { setSlugEdited(true); setDraft({ ...draft, slug: event.target.value }); }} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="blog-author">Author</Label>
            <Input id="blog-author" value={draft.authorName} placeholder="Uses your name if left blank" onChange={(event) => setDraft({ ...draft, authorName: event.target.value })} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="blog-excerpt">Short summary</Label>
          <Input id="blog-excerpt" value={draft.excerpt} placeholder="One or two lines for the blog list" onChange={(event) => setDraft({ ...draft, excerpt: event.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="blog-body">Post</Label>
          <Textarea id="blog-body" value={draft.body} className="min-h-48" placeholder="Write the post." onChange={(event) => setDraft({ ...draft, body: event.target.value })} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-sm">
            <ImagePlus className="size-4" />
            Cover photo
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                void prepareCover(file).then((dataUrl) => {
                  setDraft({ ...draft, coverDataUrl: dataUrl, hasCover: true });
                  setPreview(dataUrl);
                }).catch((error: unknown) => {
                  toast.error(error instanceof Error ? error.message : "Could not read that photo.");
                });
              }}
            />
          </label>
          {coverSrc ? (
            <Button type="button" variant="outline" size="sm" onClick={() => { setDraft({ ...draft, coverDataUrl: "", hasCover: false }); setPreview(""); }}>Remove cover</Button>
          ) : null}
          <Button type="button" variant={draft.published ? "default" : "outline"} onClick={() => setDraft({ ...draft, published: !draft.published })}>
            {draft.published ? "Published" : "Draft"}
          </Button>
          <Button type="button" variant={draft.featured ? "default" : "outline"} onClick={() => setDraft({ ...draft, featured: !draft.featured })}>
            {draft.featured ? "Featured" : "Feature this post"}
          </Button>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="blog-tags">Tags</Label>
          <Input id="blog-tags" value={draft.tags} placeholder="tournament, ps5, weekend" onChange={(event) => setDraft({ ...draft, tags: event.target.value })} />
          <p className="text-sm text-muted-foreground">Separate tags with commas. Up to 8. They become filters on the blog.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="blog-seo-title">Search title</Label>
            <Input id="blog-seo-title" value={draft.seoTitle} maxLength={70} placeholder="Shown in Google. Blank uses the post title." onChange={(event) => setDraft({ ...draft, seoTitle: event.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="blog-seo-description">Search description</Label>
            <Input id="blog-seo-description" value={draft.seoDescription} maxLength={160} placeholder="Blank uses the summary." onChange={(event) => setDraft({ ...draft, seoDescription: event.target.value })} />
          </div>
        </div>
        {coverSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverSrc} alt="" className="aspect-[16/7] w-full max-w-xl rounded-xl object-cover" />
        ) : null}
        <Button type="button" disabled={busy} onClick={() => void save()}>{busy ? "Saving..." : draft.id ? "Save post" : draft.published ? "Publish post" : "Save draft"}</Button>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-lg font-semibold">Posts</h2>
        {(data || []).map((post) => (
          <article key={post.id} className="gz-panel flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-medium">{post.title} <span className="font-normal text-muted-foreground">{post.published ? "Published" : "Draft"}{post.featured ? " · featured" : ""}</span></p>
              <p className="text-sm text-muted-foreground">{post.postedAt}{post.authorName ? ` · ${post.authorName}` : ""}{post.tags?.length ? ` · ${post.tags.join(", ")}` : ""}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {post.published ? <Button type="button" variant="outline" size="sm" asChild><a href={`/blog/${post.slug}`} target="_blank" rel="noreferrer">View</a></Button> : null}
              <Button type="button" variant="outline" size="sm" onClick={() => void edit(post)}>Edit</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => void remove(post)}>Delete</Button>
            </div>
          </article>
        ))}
        {data?.length === 0 ? <p className="text-sm text-muted-foreground">No posts yet.</p> : null}
      </section>
    </div>
  );
}
