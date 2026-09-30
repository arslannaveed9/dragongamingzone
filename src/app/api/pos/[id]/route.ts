import { authed, readJson } from "@/lib/http";
import { productSchema, stockAdjustSchema } from "@/lib/validators";
import { adjustStock, archiveProduct, saveProduct } from "@/services/product-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params;
  return authed("pos.manage", async (actor) => {
    const body = await readJson(request);
    if (body && typeof body === "object" && "delta" in body) {
      const stock = stockAdjustSchema.parse(body);
      return adjustStock(id, stock.delta, stock.note || "", actor);
    }
    return saveProduct(id, productSchema.parse(body), actor);
  });
}

export async function DELETE(_request: Request, context: Context) {
  const { id } = await context.params;
  return authed("pos.manage", async (actor) => archiveProduct(id, actor));
}
