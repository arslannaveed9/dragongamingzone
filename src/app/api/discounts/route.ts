import { authed, readJson } from "@/lib/http";
import { discountSchema } from "@/lib/validators";
import { listDiscounts, saveDiscount } from "@/services/catalog-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return authed("discounts.manage", async () => listDiscounts());
}

export async function POST(request: Request) {
  return authed("discounts.manage", async (actor) => saveDiscount(null, discountSchema.parse(await readJson(request)), actor));
}
