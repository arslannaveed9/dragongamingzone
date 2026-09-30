import { authed, readJson } from "@/lib/http";
import { noticeActiveSchema } from "@/lib/validators";
import { setNoticeActive } from "@/services/notice-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params;
  return authed("notices.manage", async (actor) => {
    const { active } = noticeActiveSchema.parse(await readJson(request));
    return setNoticeActive(id, active, actor);
  });
}
