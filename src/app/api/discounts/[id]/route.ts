import { authed, readJson } from "@/lib/http";
import { discountSchema } from "@/lib/validators";
import { archiveDiscount, saveDiscount } from "@/services/catalog-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params;
  return authed("discounts.manage", async (actor) => saveDiscount(id, discountSchema.parse(await readJson(request)), actor));
}

export async function DELETE(_request: Request, context: Context) {
  const { id } = await context.params;
  return authed("discounts.manage", async (actor) => archiveDiscount(id, actor));
}
