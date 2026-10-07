import { authed, readJson } from "@/lib/http";
import { blogSchema } from "@/lib/validators";
import { createBlog, listBlogs } from "@/services/blog-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return authed("settings.manage", async () => listBlogs(false));
}

export async function POST(request: Request) {
  return authed("settings.manage", async (actor) => createBlog(blogSchema.parse(await readJson(request)), actor));
}
