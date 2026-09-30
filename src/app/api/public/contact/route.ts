import { clientKey, rateLimit } from "@/lib/rate-limit";
import { connectDB } from "@/lib/mongodb";
import { errorResponse, json, open, readJson } from "@/lib/http";
import { contactSchema, zodMessage } from "@/lib/validators";
import { ContactInquiry } from "@/models/contact";
import { ensureBootstrap } from "@/services/bootstrap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!rateLimit(clientKey(request, "contact"), 5, 10 * 60 * 1000)) {
      return json({ error: { code: "RATE_LIMIT", message: "Please wait a few minutes before sending another message." } }, 429);
    }
    await connectDB();
    await ensureBootstrap();
    const parsed = contactSchema.safeParse(await readJson(request));
    if (!parsed.success) return json({ error: { code: "VALIDATION", message: zodMessage(parsed.error) } }, 400);
    await ContactInquiry.create(parsed.data);
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export { open };
