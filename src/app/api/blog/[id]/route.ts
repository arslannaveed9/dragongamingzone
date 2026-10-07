import { authed, readJson } from "@/lib/http";
import { blogUpdateSchema } from "@/lib/validators";
import { getBlog, removeBlog, updateBlog } from "@/services/blog-service";
import { AppError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  return authed("settings.manage", async () => {
    const post = await getBlog(id);
    if (!post) throw new AppError(404, "NOT_FOUND", "That post was not found.");
    return post;
  });
}

export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params;
  return authed("settings.manage", async (actor) => updateBlog(id, blogUpdateSchema.parse(await readJson(request)), actor));
}

export async function DELETE(_request: Request, context: Context) {
  const { id } = await context.params;
  return authed("settings.manage", async (actor) => removeBlog(id, actor));
}
