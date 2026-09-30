"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, money, usePoll } from "@/components/admin/client";
import { can, type Role } from "@/lib/permissions";

type Product = { id: string; name: string; sku: string; category: string; sellingPrice: number; stockQuantity: number; minimumStock: number; active: boolean; lowStock: boolean };
type Order = { id: string; orderNumber: string; total: number; paymentMethod: string; createdAt: string };

export default function PosPage() {
  const { data, reload } = usePoll<{ products: Product[]; orders: Order[] }>("/api/pos");
  const me = usePoll<{ user: { role: Role } }>("/api/auth/me");
  const canManage = me.data ? can(me.data.user.role, "pos.manage") : false;
  const [form, setForm] = useState({ name: "", sku: "", category: "Snacks", purchasePrice: 0, sellingPrice: 0, stockQuantity: 0, minimumStock: 0 });
  const [qty, setQty] = useState<Record<string, number>>({});

  async function saveProduct() {
    try {
      await api("/api/pos", { method: "POST", body: JSON.stringify({ ...form, active: true }) });
      toast.success("Product saved.");
      setForm({ name: "", sku: "", category: "Snacks", purchasePrice: 0, sellingPrice: 0, stockQuantity: 0, minimumStock: 0 });
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the product.");
    }
  }

  async function sell() {
    const items = Object.entries(qty).filter(([, quantity]) => quantity > 0).map(([productId, quantity]) => ({ productId, quantity }));
    if (items.length === 0) return;
    try {
      const order = await api<{ orderNumber: string; total: number }>("/api/pos", { method: "POST", body: JSON.stringify({ items, paymentMethod: "cash", discountAmount: 0 }) });
      toast.success(`${order.orderNumber} · ${money(order.total)}`);
      setQty({});
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not record the sale.");
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">POS</h1>
        <p className="text-sm text-muted-foreground">{canManage ? "Sell stock now, or add products for the counter." : "Sell stock at the counter. Adding products is limited to a manager."}</p>
      </div>
      {canManage && <div className="grid gap-2 rounded-xl border border-border bg-card p-4 md:grid-cols-4">
        <Input placeholder="Product" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <Input placeholder="SKU" value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} />
        <Input placeholder="Category" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
        <Input type="number" placeholder="Sell price" value={form.sellingPrice} onChange={(event) => setForm({ ...form, sellingPrice: Number(event.target.value) })} />
        <Input type="number" placeholder="Cost" value={form.purchasePrice} onChange={(event) => setForm({ ...form, purchasePrice: Number(event.target.value) })} />
        <Input type="number" placeholder="Stock" value={form.stockQuantity} onChange={(event) => setForm({ ...form, stockQuantity: Number(event.target.value) })} />
        <Input type="number" placeholder="Min stock" value={form.minimumStock} onChange={(event) => setForm({ ...form, minimumStock: Number(event.target.value) })} />
        <Button onClick={saveProduct}>Add product</Button>
      </div>}
      <div className="grid gap-2">
        {(data?.products || []).map((product) => (
          <div key={product.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-4 py-3 text-sm">
            <div>
              <p className="font-medium">{product.name} <span className="text-muted-foreground">{product.sku}</span></p>
              <p className="text-muted-foreground">{product.category} · {money(product.sellingPrice)} · stock {product.stockQuantity}{product.lowStock ? " · low" : ""}</p>
            </div>
            <Input className="w-20" type="number" min={0} value={qty[product.id] || 0} onChange={(event) => setQty({ ...qty, [product.id]: Number(event.target.value) })} />
          </div>
        ))}
        {data?.products.length === 0 && <p className="text-sm text-muted-foreground">No products yet.</p>}
        <Button className="w-fit" onClick={sell}>Record cash sale</Button>
      </div>
      <div>
        <h2 className="mb-2 text-sm font-medium">Recent sales</h2>
        {(data?.orders || []).map((order) => (
          <div key={order.id} className="flex justify-between border-b border-border py-2 text-sm">
            <span>{order.orderNumber} · {order.paymentMethod}</span>
            <span>{money(order.total)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
