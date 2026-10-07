import { connectDB } from "@/lib/mongodb";
import { decodeDataImage } from "@/lib/brand-icon";
import { galleryImage } from "@/services/gallery-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  await connectDB();
  const dataUrl = await galleryImage(id);
  const image = dataUrl ? decodeDataImage(dataUrl) : null;
  if (!image) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(image.bytes), {
    headers: {
      "Content-Type": image.type,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
