import { connectDB } from "@/lib/mongodb";
import { decodeDataImage } from "@/lib/brand-icon";
import { BlogPost } from "@/models/blog-post";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: Context) {
  const { slug } = await context.params;
  await connectDB();
  const row = await BlogPost.findOne({ slug: decodeURIComponent(slug), published: true }).select("coverDataUrl").lean<{ coverDataUrl?: string }>();
  const image = row?.coverDataUrl ? decodeDataImage(row.coverDataUrl) : null;
  if (!image) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(image.bytes), {
    headers: {
      "Content-Type": image.type,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
