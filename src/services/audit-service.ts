import { AuditLog } from "@/models/audit-log";
import type { Actor } from "@/services/auth-service";

export async function writeAudit(entry: {
  actor?: Actor | null;
  action: string;
  entity: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
  metadata?: unknown;
}) {
  await AuditLog.create({
    userId: entry.actor?.id ?? null,
    userName: entry.actor?.name ?? "System",
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    oldValue: entry.oldValue ?? null,
    newValue: entry.newValue ?? null,
    metadata: entry.metadata ?? null,
  });
}

export async function listAudit(query: { page: number; pageSize: number; entity?: string; action?: string }) {
  const filter: Record<string, unknown> = {};
  if (query.entity) filter.entity = query.entity;
  if (query.action) filter.action = query.action;
  const skip = (query.page - 1) * query.pageSize;
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.pageSize).lean(),
    AuditLog.countDocuments(filter),
  ]);
  return {
    items: items.map((item) => ({
      id: String(item._id),
      userId: item.userId ? String(item.userId) : null,
      userName: item.userName,
      action: item.action,
      entity: item.entity,
      entityId: item.entityId,
      oldValue: item.oldValue ?? null,
      newValue: item.newValue ?? null,
      createdAt: item.createdAt,
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}
