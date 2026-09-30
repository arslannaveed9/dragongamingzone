import { authed, readJson } from "@/lib/http";
import { pricingRuleSchema } from "@/lib/validators";
import { archivePricingRule, savePricingRule } from "@/services/catalog-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params;
  return authed("pricing.manage", async (actor) => savePricingRule(id, pricingRuleSchema.parse(await readJson(request)), actor));
}

export async function DELETE(_request: Request, context: Context) {
  const { id } = await context.params;
  return authed("pricing.manage", async (actor) => archivePricingRule(id, actor));
}
