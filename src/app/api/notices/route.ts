import { authed, readJson } from "@/lib/http";
import { noticeSchema } from "@/lib/validators";
import { createNotice, listNotices } from "@/services/notice-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const all = new URL(request.url).searchParams.get("all") === "1";
  if (all) {
    return authed("notices.manage", async () => listNotices({}));
  }
  return authed("dashboard.view", async () => listNotices({ audience: "staff", activeOnly: true }));
}

export async function POST(request: Request) {
  return authed("notices.manage", async (actor) => createNotice(noticeSchema.parse(await readJson(request)), actor));
}
