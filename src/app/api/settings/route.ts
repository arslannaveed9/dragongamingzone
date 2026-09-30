import { authed, readJson } from "@/lib/http";
import { settingsSchema } from "@/lib/validators";
import { getSettings, updateSettings } from "@/services/settings-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return authed("settings.manage", async () => getSettings());
}

export async function PUT(request: Request) {
  return authed("settings.manage", async (actor) => {
    const body = settingsSchema.parse(await readJson(request));
    return updateSettings(body, actor);
  });
}
