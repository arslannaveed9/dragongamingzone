import { authed, readJson } from "@/lib/http";
import { customerSchema } from "@/lib/validators";
import { getCustomer, updateCustomer } from "@/services/customer-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  return authed("customers.manage", async () => getCustomer(id));
}

export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params;
  return authed("customers.manage", async (actor) => updateCustomer(id, customerSchema.parse(await readJson(request)), actor));
}
