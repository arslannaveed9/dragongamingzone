import { decodeDataImage, letterIcon } from "@/lib/brand-icon";
import { getSettings } from "@/services/settings-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getSettings();
  const image = decodeDataImage(settings.seo.ogImageDataUrl) || decodeDataImage(settings.business.logoDataUrl);
  if (image) {
    return new Response(Buffer.from(image.bytes), {
      headers: { "Content-Type": image.type, "Cache-Control": "public, max-age=3600, must-revalidate" },
    });
  }
  return new Response(letterIcon(settings.business.name), {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=3600, must-revalidate" },
  });
}
