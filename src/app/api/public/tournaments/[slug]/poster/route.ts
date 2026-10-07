import { connectDB } from "@/lib/mongodb";
import { decodeDataImage } from "@/lib/brand-icon";
import { Tournament } from "@/models/tournament";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: Context) {
  const { slug } = await context.params;
  await connectDB();
  const row = await Tournament.findOne({ slug: decodeURIComponent(slug), published: true, cancelled: { $ne: true } }).select("posterDataUrl").lean<{ posterDataUrl?: string }>();
  const image = row?.posterDataUrl ? decodeDataImage(row.posterDataUrl) : null;
  if (!image) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(image.bytes), {
    headers: { "Content-Type": image.type, "Cache-Control": "public, max-age=3600" },
  });
}
