import { z } from "zod";
import { clearFiguresCookie, figuresUnlocked, setFiguresCookie } from "@/lib/figures";
import { authed, readJson } from "@/lib/http";
import { checkFiguresPassword, figuresPasswordConfigured, setFiguresPassword } from "@/services/settings-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const passwordSchema = z.object({
  password: z.string().min(4, "Use at least 4 characters.").max(80),
});

export async function GET() {
  return authed("dashboard.view", async () => ({
    configured: await figuresPasswordConfigured(),
    unlocked: await figuresUnlocked(),
  }));
}

export async function POST(request: Request) {
  return authed("dashboard.view", async () => {
    const { password } = passwordSchema.parse(await readJson(request));
    await checkFiguresPassword(password);
    await setFiguresCookie();
    return { unlocked: true };
  });
}

export async function DELETE() {
  return authed("dashboard.view", async () => {
    await clearFiguresCookie();
    return { unlocked: false };
  });
}

export async function PUT(request: Request) {
  return authed("settings.manage", async (actor) => {
    const { password } = passwordSchema.parse(await readJson(request));
    await setFiguresPassword(password, actor);
    return { configured: true };
  });
}
