import { authed, readJson } from "@/lib/http";
import { galleryUpdateSchema } from "@/lib/validators";
import { removeGalleryPhoto, updateGalleryPhoto } from "@/services/gallery-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params;
  return authed("settings.manage", async (actor) => updateGalleryPhoto(id, galleryUpdateSchema.parse(await readJson(request)), actor));
}

export async function DELETE(_request: Request, context: Context) {
  const { id } = await context.params;
  return authed("settings.manage", async (actor) => removeGalleryPhoto(id, actor));
}
