import { connectDB } from "@/lib/mongodb";
import { AppError } from "@/lib/errors";
import { open } from "@/lib/http";
import { getPublishedBlog } from "@/services/blog-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: Context) {
  const { slug } = await context.params;
  return open(async () => {
    await connectDB();
    const post = await getPublishedBlog(decodeURIComponent(slug));
    if (!post) throw new AppError(404, "NOT_FOUND", "That post was not found.");
    return post;
  });
}
