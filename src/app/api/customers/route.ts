import { authed, pageParams, readJson } from "@/lib/http";
import { customerSchema } from "@/lib/validators";
import { createCustomer, listCustomers, searchCustomers } from "@/services/customer-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") || "";
  if (url.searchParams.get("suggest") === "1") {
    return authed("bookings.create", async () => searchCustomers(q));
  }
  return authed("customers.manage", async () => listCustomers({ ...pageParams(url), q }));
}

export async function POST(request: Request) {
  return authed("customers.manage", async (actor) => createCustomer(customerSchema.parse(await readJson(request)), actor));
}
