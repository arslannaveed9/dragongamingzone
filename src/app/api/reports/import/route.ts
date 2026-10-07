import { authed } from "@/lib/http";
import { AppError } from "@/lib/errors";
import { importLegacyReport } from "@/services/legacy-import-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return authed("reports.view", async (actor) => {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new AppError(400, "FILE", "Choose the old revenue report.");
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      throw new AppError(400, "FILE", "Use the .xlsx revenue report from the old software.");
    }
    if (file.size > 8_000_000) throw new AppError(400, "FILE", "That file is too large.");
    return importLegacyReport(Buffer.from(await file.arrayBuffer()), actor);
  });
}
