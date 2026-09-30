import { AppError } from "@/lib/errors";
import { roundMoney } from "@/lib/money";
import { getGamingDay } from "@/lib/gaming-day";
import { Counter } from "@/models/counter";
import { Product, StockMovement } from "@/models/product";
import { PosOrder } from "@/models/pos";
import { Booking } from "@/models/booking";
import { writeAudit } from "@/services/audit-service";
import type { Actor } from "@/services/auth-service";
import { getSettings } from "@/services/settings-service";

function productPlain(doc: {
  _id: unknown;
  name: string;
  sku: string;
  category: string;
  purchasePrice: number;
  sellingPrice: number;
  stockQuantity: number;
  minimumStock: number;
  active: boolean;
  archived?: boolean;
}) {
  return {
    id: String(doc._id),
    name: doc.name,
    sku: doc.sku,
    category: doc.category,
    purchasePrice: doc.purchasePrice,
    sellingPrice: doc.sellingPrice,
    stockQuantity: doc.stockQuantity,
    minimumStock: doc.minimumStock,
    active: doc.active,
    archived: Boolean(doc.archived),
    lowStock: doc.stockQuantity <= doc.minimumStock,
  };
}

export async function listProducts(includeArchived = false) {
  const rows = await Product.find(includeArchived ? {} : { archived: false }).sort({ category: 1, name: 1 }).lean();
  return rows.map((row) => productPlain(row as never));
}

export async function saveProduct(
  id: string | null,
  input: {
    name: string;
    sku: string;
    category: string;
    purchasePrice: number;
    sellingPrice: number;
    stockQuantity: number;
    minimumStock: number;
    active?: boolean;
  },
  actor: Actor,
) {
  const sku = input.sku.trim();
  if (id) {
    const existing = await Product.findById(id);
    if (!existing || existing.archived) throw new AppError(404, "NOT_FOUND", "Product not found.");
    const duplicate = await Product.findOne({ sku, _id: { $ne: id }, archived: false });
    if (duplicate) throw new AppError(409, "DUPLICATE", "That SKU is already in use.");
    const previousStock = existing.stockQuantity;
    Object.assign(existing, { ...input, sku });
    await existing.save();
    if (previousStock !== input.stockQuantity) {
      await StockMovement.create({
        productId: existing._id,
        delta: input.stockQuantity - previousStock,
        reason: "adjustment",
        note: "Edited from product form",
        createdBy: actor.id,
      });
    }
    await writeAudit({ actor, action: "product.updated", entity: "product", entityId: id, newValue: { name: input.name, sku } });
    return productPlain(existing);
  }
  const duplicate = await Product.findOne({ sku, archived: false });
  if (duplicate) throw new AppError(409, "DUPLICATE", "That SKU is already in use.");
  const created = await Product.create({ ...input, sku, archived: false });
  if (input.stockQuantity > 0) {
    await StockMovement.create({
      productId: created._id,
      delta: input.stockQuantity,
      reason: "receive",
      note: "Opening stock",
      createdBy: actor.id,
    });
  }
  await writeAudit({ actor, action: "product.created", entity: "product", entityId: String(created._id), newValue: { name: created.name, sku } });
  return productPlain(created);
}

export async function adjustStock(id: string, delta: number, note: string, actor: Actor) {
  const product = await Product.findById(id);
  if (!product || product.archived) throw new AppError(404, "NOT_FOUND", "Product not found.");
  const next = product.stockQuantity + delta;
  if (next < 0) throw new AppError(400, "STOCK", "Stock cannot go below zero.");
  product.stockQuantity = next;
  await product.save();
  await StockMovement.create({
    productId: product._id,
    delta,
    reason: delta > 0 ? "receive" : "adjustment",
    note,
    createdBy: actor.id,
  });
  return productPlain(product);
}

export async function archiveProduct(id: string, actor: Actor) {
  const product = await Product.findById(id);
  if (!product) throw new AppError(404, "NOT_FOUND", "Product not found.");
  product.archived = true;
  product.active = false;
  await product.save();
  await writeAudit({ actor, action: "product.archived", entity: "product", entityId: id });
  return productPlain(product);
}

export async function createPosOrder(
  input: {
    bookingId?: string | null;
    items: { productId: string; quantity: number }[];
    discountAmount?: number;
    paymentMethod: string;
    notes?: string;
  },
  actor: Actor,
) {
  const settings = await getSettings();
  const gamingDay = getGamingDay(new Date(), settings.operatingHours);
  let customerId: string | null = null;
  if (input.bookingId) {
    const booking = await Booking.findById(input.bookingId);
    if (!booking) throw new AppError(404, "NOT_FOUND", "Booking not found.");
    customerId = booking.customerId ? String(booking.customerId) : null;
  }
  const lines = [];
  for (const item of input.items) {
    const product = await Product.findById(item.productId);
    if (!product || product.archived || !product.active) {
      throw new AppError(400, "PRODUCT", "One of the products is not available.");
    }
    if (product.stockQuantity < item.quantity) {
      throw new AppError(400, "STOCK", `${product.name} only has ${product.stockQuantity} in stock.`);
    }
    lines.push({ product, quantity: item.quantity });
  }
  const subtotal = roundMoney(lines.reduce((sum, line) => sum + line.product.sellingPrice * line.quantity, 0));
  const discountAmount = Math.min(subtotal, input.discountAmount || 0);
  const total = roundMoney(subtotal - discountAmount);
  const counter = await Counter.findByIdAndUpdate("pos", { $inc: { seq: 1 } }, { upsert: true, new: true });
  const order = await PosOrder.create({
    orderNumber: `POS-${String(counter.seq).padStart(4, "0")}`,
    bookingId: input.bookingId || null,
    customerId,
    items: lines.map((line) => ({
      productId: line.product._id,
      name: line.product.name,
      sku: line.product.sku,
      quantity: line.quantity,
      unitPrice: line.product.sellingPrice,
      lineTotal: roundMoney(line.product.sellingPrice * line.quantity),
    })),
    discountAmount,
    total,
    paymentMethod: input.paymentMethod,
    paymentStatus: "paid",
    gamingDay,
    notes: input.notes || "",
    createdBy: actor.id,
    createdByName: actor.name,
  });
  for (const line of lines) {
    line.product.stockQuantity -= line.quantity;
    await line.product.save();
    await StockMovement.create({
      productId: line.product._id,
      delta: -line.quantity,
      reason: "sale",
      orderId: order._id,
      note: order.orderNumber,
      createdBy: actor.id,
    });
  }
  await writeAudit({
    actor,
    action: "pos.sale",
    entity: "pos_order",
    entityId: String(order._id),
    newValue: { total, bookingId: input.bookingId || null },
  });
  return {
    id: String(order._id),
    orderNumber: order.orderNumber,
    total,
    items: order.items,
    currencySymbol: settings.system.currencySymbol,
  };
}

export async function listPosOrders(limit = 30) {
  const rows = await PosOrder.find().sort({ createdAt: -1 }).limit(limit).lean();
  return rows.map((row) => ({
    id: String(row._id),
    orderNumber: row.orderNumber,
    total: row.total,
    items: row.items,
    paymentMethod: row.paymentMethod,
    gamingDay: row.gamingDay,
    bookingId: row.bookingId ? String(row.bookingId) : null,
    createdAt: row.createdAt,
    createdByName: row.createdByName,
  }));
}
