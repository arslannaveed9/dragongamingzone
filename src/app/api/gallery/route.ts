import { authed, readJson } from "@/lib/http";
import { galleryPhotoSchema } from "@/lib/validators";
import { addGalleryPhoto, listGallery } from "@/services/gallery-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return authed("settings.manage", async () => listGallery());
}

export async function POST(request: Request) {
  return authed("settings.manage", async (actor) => addGalleryPhoto(galleryPhotoSchema.parse(await readJson(request)), actor));
}
