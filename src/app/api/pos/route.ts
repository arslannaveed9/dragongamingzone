import { authed, errorResponse, readJson } from "@/lib/http";
import { productSchema } from "@/lib/validators";
import { createPosOrder, listPosOrders, listProducts, saveProduct } from "@/services/product-service";
import { posOrderSchema } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return authed("pos.view", async () => {
    const [products, orders] = await Promise.all([listProducts(false), listPosOrders()]);
    return { products, orders };
  });
}

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    if (body && typeof body === "object" && "items" in body) {
      return authed("pos.view", async (actor) => createPosOrder(posOrderSchema.parse(body), actor));
    }
    return authed("pos.manage", async (actor) => saveProduct(null, productSchema.parse(body), actor));
  } catch (error) {
    return errorResponse(error);
  }
}
