"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, notifyRefresh, usePoll } from "@/components/admin/client";
import { GALLERY_LIMIT } from "@/lib/gallery";

type Photo = { id: string; caption: string };

async function preparePhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose a JPG, PNG, or WebP photo.");
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error("Could not read that photo.");
  const maxEdge = 1600;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not read that photo.");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
  if (dataUrl.length > 1_400_000) throw new Error("That photo is still too large. Try a smaller one.");
  return dataUrl;
}

export default function GalleryPage() {
  const { data, reload } = usePoll<Photo[]>("/api/gallery");
  const photos = data || [];
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  function captionOf(photo: Photo) {
    return captions[photo.id] ?? photo.caption;
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    let added = 0;
    try {
      for (const file of Array.from(files)) {
        if (photos.length + added >= GALLERY_LIMIT) {
          toast.error(`The gallery holds ${GALLERY_LIMIT} photos. Remove one to add another.`);
          break;
        }
        const dataUrl = await preparePhoto(file);
        await api("/api/gallery", { method: "POST", body: JSON.stringify({ dataUrl, caption: "" }) });
        added += 1;
      }
      if (added) {
        toast.success(added === 1 ? "Photo added to the homepage." : `${added} photos added to the homepage.`);
        notifyRefresh();
        await reload();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add the photo.");
      if (added) await reload();
    } finally {
      setBusy(false);
    }
  }

  async function saveCaption(photo: Photo) {
    const caption = captionOf(photo).trim();
    if (caption === photo.caption) return;
    try {
      await api(`/api/gallery/${photo.id}`, { method: "PATCH", body: JSON.stringify({ caption }) });
      toast.success("Caption saved.");
      notifyRefresh();
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the caption.");
    }
  }

  async function move(photo: Photo, direction: "earlier" | "later") {
    try {
      await api(`/api/gallery/${photo.id}`, { method: "PATCH", body: JSON.stringify({ direction }) });
      notifyRefresh();
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not move the photo.");
    }
  }

  async function remove(photo: Photo) {
    try {
      await api(`/api/gallery/${photo.id}`, { method: "DELETE" });
      toast.success("Photo removed.");
      notifyRefresh();
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove the photo.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="gz-kicker text-cyan-800 dark:text-cyan-200">Homepage</p>
          <h1 className="gz-title">Gallery</h1>
          <p className="mt-2 max-w-3xl text-base text-muted-foreground">
            Photos added here show on the public homepage. {photos.length} of {GALLERY_LIMIT} used.
          </p>
        </div>
        <label className={`inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground ${busy || photos.length >= GALLERY_LIMIT ? "pointer-events-none opacity-50" : ""}`}>
          <ImagePlus className="size-4" />
          Add photos
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            disabled={busy || photos.length >= GALLERY_LIMIT}
            onChange={(event) => {
              void upload(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
      </div>
      {photos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-muted-foreground">No photos yet. Add a few shots of the floor, consoles, or the shop front.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {photos.map((photo, index) => (
            <li key={photo.id} className="overflow-hidden rounded-2xl border border-border bg-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/public/gallery/${photo.id}`} alt={photo.caption || "Gallery photo"} className="aspect-[4/3] w-full object-cover" />
              <div className="space-y-3 p-3">
                <Input
                  value={captionOf(photo)}
                  placeholder="Caption, optional"
                  maxLength={120}
                  onChange={(event) => setCaptions({ ...captions, [photo.id]: event.target.value })}
                  onBlur={() => void saveCaption(photo)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" disabled={index === 0} onClick={() => move(photo, "earlier")} aria-label="Move earlier">
                    <ChevronUp className="size-4" />
                  </Button>
                  <Button type="button" size="sm" variant="outline" disabled={index === photos.length - 1} onClick={() => move(photo, "later")} aria-label="Move later">
                    <ChevronDown className="size-4" />
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="ml-auto" onClick={() => remove(photo)}>Remove</Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
