import { DateTime } from "luxon";
import { AppError } from "@/lib/errors";
import { BlogPost } from "@/models/blog-post";
import { writeAudit } from "@/services/audit-service";
import type { Actor } from "@/services/auth-service";
import { getSettings } from "@/services/settings-service";

export type BlogListItem = {
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

export type BlogArticle = BlogListItem & {
  body: string;
  seoTitle: string;
  seoDescription: string;
  related: BlogListItem[];
};

type Row = {
  _id: unknown;
  slug: string;
  title: string;
  excerpt?: string;
  body?: string;
  published?: boolean;
  authorName?: string;
  hasCover?: boolean;
  createdAt?: Date;
  tags?: string[];
  featured?: boolean;
  readingMinutes?: number;
  seoTitle?: string;
  seoDescription?: string;
  coverDataUrl?: string;
};

export function readingMinutes(body: string) {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function cleanTags(tags: string[]) {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const tag of tags) {
    const clean = tag.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 24);
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    next.push(clean);
    if (next.length === 8) break;
  }
  return next;
}

function slugify(title: string) {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  return base || "post";
}

async function uniqueSlug(raw: string, ignoreId?: string) {
  const base = slugify(raw);
  let slug = base;
  let n = 2;
  for (;;) {
    const found = await BlogPost.findOne({ slug }).select("_id").lean<{ _id: unknown }>();
    if (!found || (ignoreId && String(found._id) === ignoreId)) return slug;
    slug = `${base}-${n}`;
    n += 1;
  }
}

async function timezone() {
  const settings = await getSettings();
  return settings.operatingHours.timezone;
}

function item(row: Row, zone: string): BlogListItem {
  return {
    id: String(row._id),
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt || "",
    published: row.published !== false,
    authorName: row.authorName || "",
    hasCover: Boolean(row.hasCover),
    postedAt: row.createdAt ? DateTime.fromJSDate(new Date(row.createdAt)).setZone(zone).toFormat("d LLL yyyy") : "",
    tags: row.tags || [],
    featured: Boolean(row.featured),
    readingMinutes: row.readingMinutes || 1,
  };
}

const listProject = {
  title: 1,
  slug: 1,
  excerpt: 1,
  published: 1,
  authorName: 1,
  createdAt: 1,
  tags: 1,
  featured: 1,
  readingMinutes: 1,
  hasCover: { $gt: [{ $strLenCP: { $ifNull: ["$coverDataUrl", ""] } }, 0] },
};

export async function listBlogs(publishedOnly: boolean): Promise<BlogListItem[]> {
  const zone = await timezone();
  const rows = await BlogPost.aggregate<Row>([
    ...(publishedOnly ? [{ $match: { published: true } }] : []),
    { $sort: publishedOnly ? { featured: -1, createdAt: -1 } : { createdAt: -1 } },
    { $project: listProject },
  ]);
  return rows.map((row) => item(row, zone));
}

async function toArticle(row: Row & { body: string }, related: BlogListItem[]): Promise<BlogArticle> {
  const zone = await timezone();
  return {
    ...item({ ...row, hasCover: Boolean(row.coverDataUrl) }, zone),
    body: row.body,
    seoTitle: row.seoTitle || "",
    seoDescription: row.seoDescription || "",
    related,
  };
}

async function asList(rows: Row[]) {
  const zone = await timezone();
  const covered = new Set(
    (await BlogPost.find({ _id: { $in: rows.map((row) => row._id) }, coverDataUrl: { $gt: "" } }).select("_id").lean<{ _id: unknown }[]>()).map((row) => String(row._id)),
  );
  return rows.map((row) => item({ ...row, hasCover: covered.has(String(row._id)) }, zone));
}

async function relatedPosts(row: { _id: unknown; tags?: string[] }) {
  const tags = row.tags || [];
  const base = { published: true, _id: { $ne: row._id } };
  const fields = "slug title excerpt published authorName createdAt tags featured readingMinutes";
  const matched = tags.length
    ? await BlogPost.find({ ...base, tags: { $in: tags } }).sort({ createdAt: -1 }).limit(3).select(fields).lean<Row[]>()
    : [];
  const filler = matched.length >= 3
    ? []
    : await BlogPost.find({ ...base, _id: { $nin: [row._id, ...matched.map((post) => post._id)] } }).sort({ createdAt: -1 }).limit(3 - matched.length).select(fields).lean<Row[]>();
  return asList([...matched, ...filler]);
}

export async function getPublishedBlog(slug: string): Promise<BlogArticle | null> {
  const row = await BlogPost.findOne({ slug, published: true }).lean<Row & { body: string }>();
  if (!row) return null;
  return toArticle(row, await relatedPosts(row));
}

export async function getBlog(id: string): Promise<BlogArticle | null> {
  if (!/^[a-f\d]{24}$/i.test(id)) return null;
  const row = await BlogPost.findById(id).lean<Row & { body: string }>();
  if (!row) return null;
  return toArticle(row, []);
}

export async function blogCover(id: string) {
  if (!/^[a-f\d]{24}$/i.test(id)) return null;
  const row = await BlogPost.findById(id).select("coverDataUrl published").lean<{ coverDataUrl?: string; published?: boolean }>();
  if (!row?.coverDataUrl || row.published === false) return null;
  return row.coverDataUrl;
}

type BlogInput = {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  coverDataUrl?: string;
  authorName: string;
  tags: string[];
  featured: boolean;
  seoTitle: string;
  seoDescription: string;
  published: boolean;
};

export async function createBlog(input: BlogInput, actor: Actor) {
  const created = await BlogPost.create({
    title: input.title,
    slug: await uniqueSlug(input.slug || input.title),
    excerpt: input.excerpt,
    body: input.body,
    coverDataUrl: input.coverDataUrl || "",
    published: input.published,
    authorName: input.authorName || actor.name,
    tags: cleanTags(input.tags),
    featured: input.featured,
    readingMinutes: readingMinutes(input.body),
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
  });
  await writeAudit({ actor, action: "blog.created", entity: "blog", entityId: String(created._id), newValue: { title: input.title, slug: created.slug, published: input.published } });
  const article = await getBlog(String(created._id));
  if (!article) throw new AppError(404, "NOT_FOUND", "That post was not found.");
  return article;
}

export async function updateBlog(id: string, input: BlogInput, actor: Actor) {
  const existing = await BlogPost.findById(id);
  if (!existing) throw new AppError(404, "NOT_FOUND", "That post was not found.");
  existing.title = input.title;
  existing.slug = await uniqueSlug(input.slug || input.title, id);
  existing.excerpt = input.excerpt;
  existing.body = input.body;
  existing.published = input.published;
  existing.authorName = input.authorName || existing.authorName || actor.name;
  existing.tags = cleanTags(input.tags);
  existing.featured = input.featured;
  existing.readingMinutes = readingMinutes(input.body);
  existing.seoTitle = input.seoTitle;
  existing.seoDescription = input.seoDescription;
  if (input.coverDataUrl !== undefined) existing.coverDataUrl = input.coverDataUrl;
  await existing.save();
  await writeAudit({ actor, action: "blog.updated", entity: "blog", entityId: id, newValue: { title: input.title, slug: existing.slug, published: input.published } });
  const article = await getBlog(id);
  if (!article) throw new AppError(404, "NOT_FOUND", "That post was not found.");
  return article;
}

export async function removeBlog(id: string, actor: Actor) {
  const existing = await BlogPost.findByIdAndDelete(id);
  if (!existing) throw new AppError(404, "NOT_FOUND", "That post was not found.");
  await writeAudit({ actor, action: "blog.deleted", entity: "blog", entityId: id, oldValue: { title: existing.title } });
  return { id };
}
