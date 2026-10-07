import { connectDB } from "@/lib/mongodb";
import { decodeDataImage } from "@/lib/brand-icon";
import { can } from "@/lib/permissions";
import { getSessionActor } from "@/services/auth-service";
import { BlogPost } from "@/models/blog-post";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const actor = await getSessionActor();
  if (!actor || !can(actor.role, "settings.manage")) return new Response("Not found", { status: 404 });
  const { id } = await context.params;
  if (!/^[a-f\d]{24}$/i.test(id)) return new Response("Not found", { status: 404 });
  await connectDB();
  const row = await BlogPost.findById(id).select("coverDataUrl").lean<{ coverDataUrl?: string }>();
  const image = row?.coverDataUrl ? decodeDataImage(row.coverDataUrl) : null;
  if (!image) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(image.bytes), {
    headers: { "Content-Type": image.type, "Cache-Control": "private, no-store" },
  });
}
