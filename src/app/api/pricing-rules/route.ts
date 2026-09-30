import { authed, readJson } from "@/lib/http";
import { pricingRuleSchema } from "@/lib/validators";
import { listPricingRules, savePricingRule } from "@/services/catalog-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return authed("pricing.manage", async () => listPricingRules());
}

export async function POST(request: Request) {
  return authed("pricing.manage", async (actor) => savePricingRule(null, pricingRuleSchema.parse(await readJson(request)), actor));
}
