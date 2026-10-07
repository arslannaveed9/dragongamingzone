import { connectDB } from "@/lib/mongodb";
import { open } from "@/lib/http";
import { listBlogs } from "@/services/blog-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return open(async () => {
    await connectDB();
    return listBlogs(true);
  });
}
