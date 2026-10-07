import { connectDB } from "@/lib/mongodb";
import { open } from "@/lib/http";
import { listGallery } from "@/services/gallery-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return open(async () => {
    await connectDB();
    return listGallery();
  });
}
