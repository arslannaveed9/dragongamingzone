import { AppError } from "@/lib/errors";
import { GALLERY_LIMIT } from "@/lib/gallery";
import { GalleryPhoto } from "@/models/gallery-photo";
import { writeAudit } from "@/services/audit-service";
import type { Actor } from "@/services/auth-service";

export type GalleryPhotoView = {
  id: string;
  caption: string;
};

function plain(row: { _id: unknown; caption?: string }): GalleryPhotoView {
  return { id: String(row._id), caption: row.caption || "" };
}

export async function listGallery(): Promise<GalleryPhotoView[]> {
  const rows = await GalleryPhoto.find().select("caption").sort({ sort: 1, createdAt: 1 }).lean();
  return rows.map((row) => plain(row));
}

export async function galleryImage(id: string) {
  if (!/^[a-f\d]{24}$/i.test(id)) return null;
  const row = await GalleryPhoto.findById(id).select("dataUrl").lean<{ dataUrl?: string }>();
  return row?.dataUrl || null;
}

export async function addGalleryPhoto(input: { dataUrl: string; caption: string }, actor: Actor) {
  const count = await GalleryPhoto.countDocuments();
  if (count >= GALLERY_LIMIT) {
    throw new AppError(400, "LIMIT", `The gallery holds ${GALLERY_LIMIT} photos. Remove one to add another.`);
  }
  const last = await GalleryPhoto.findOne().sort({ sort: -1 }).select("sort").lean<{ sort?: number }>();
  const created = await GalleryPhoto.create({
    dataUrl: input.dataUrl,
    caption: input.caption,
    sort: (last?.sort ?? -1) + 1,
  });
  await writeAudit({
    actor,
    action: "gallery.added",
    entity: "gallery",
    entityId: String(created._id),
    newValue: { caption: input.caption },
  });
  return plain(created);
}

export async function updateGalleryPhoto(
  id: string,
  input: { caption?: string; direction?: "earlier" | "later" },
  actor: Actor,
) {
  if (input.direction) await moveGalleryPhoto(id, input.direction);
  if (input.caption !== undefined) {
    const row = await GalleryPhoto.findById(id);
    if (!row) throw new AppError(404, "NOT_FOUND", "That photo is no longer in the gallery.");
    row.caption = input.caption;
    await row.save();
    await writeAudit({ actor, action: "gallery.updated", entity: "gallery", entityId: id, newValue: { caption: input.caption } });
  }
  return listGallery();
}

async function moveGalleryPhoto(id: string, direction: "earlier" | "later") {
  const photos = await GalleryPhoto.find().sort({ sort: 1, createdAt: 1 });
  const index = photos.findIndex((photo) => String(photo._id) === id);
  if (index < 0) throw new AppError(404, "NOT_FOUND", "That photo is no longer in the gallery.");
  const next = direction === "earlier" ? index - 1 : index + 1;
  if (next < 0 || next >= photos.length) return;
  const [photo] = photos.splice(index, 1);
  photos.splice(next, 0, photo);
  await Promise.all(photos.map((item, order) => {
    item.sort = order;
    return item.save();
  }));
}

export async function removeGalleryPhoto(id: string, actor: Actor) {
  const row = await GalleryPhoto.findByIdAndDelete(id);
  if (!row) throw new AppError(404, "NOT_FOUND", "That photo is no longer in the gallery.");
  await writeAudit({ actor, action: "gallery.removed", entity: "gallery", entityId: id, oldValue: { caption: row.caption || "" } });
  return { id };
}
