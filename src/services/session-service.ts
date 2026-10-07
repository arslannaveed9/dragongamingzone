import { AppError } from "@/lib/errors";
import { canManageRole, type Role } from "@/lib/permissions";
import { LoginSession } from "@/models/login-session";
import { User } from "@/models/user";
import { writeAudit } from "@/services/audit-service";
import type { Actor } from "@/services/auth-service";

export function clientAddress(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
}

export function deviceLabel(userAgent: string): string {
  const agent = userAgent || "";
  const device = /iPhone|iPad/.test(agent) ? "iPhone" : /Android/.test(agent) ? "Android" : /Windows/.test(agent) ? "Windows" : /Mac/.test(agent) ? "Mac" : "Browser";
  const browser = /Edg\//.test(agent) ? "Edge" : /Chrome\//.test(agent) ? "Chrome" : /Safari\//.test(agent) && !/Chrome\//.test(agent) ? "Safari" : /Firefox\//.test(agent) ? "Firefox" : "";
  return browser ? `${device} · ${browser}` : device;
}

export async function openLoginSession(userId: string, request: Request, expiresAt: Date) {
  const created = await LoginSession.create({
    userId,
    expiresAt,
    userAgent: (request.headers.get("user-agent") || "").slice(0, 300),
    ip: clientAddress(request).slice(0, 80),
  });
  return String(created._id);
}

export async function activeLoginSession(sessionId: string, userId: string) {
  if (!sessionId) return null;
  const row = await LoginSession.findById(sessionId).lean<{ _id: unknown; userId: unknown; revokedAt?: Date | null; expiresAt: Date }>();
  if (!row || row.revokedAt || row.expiresAt.getTime() <= Date.now()) return null;
  if (String(row.userId) !== userId) return null;
  return row;
}

async function manageableUser(actor: Actor, userId: string) {
  const user = await User.findById(userId);
  if (!user) throw new AppError(404, "NOT_FOUND", "User not found.");
  if (actor.id !== String(user._id) && !canManageRole(actor.role, user.role as Role)) {
    throw new AppError(403, "FORBIDDEN", "You cannot manage that account.");
  }
  return user;
}

function plainSession(row: { _id: unknown; createdAt?: Date; expiresAt: Date; userAgent?: string; ip?: string }, currentId: string) {
  const id = String(row._id);
  return {
    id,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    expiresAt: new Date(row.expiresAt).toISOString(),
    device: deviceLabel(row.userAgent || ""),
    ip: row.ip || "",
    current: id === currentId,
  };
}

export async function listLoginSessions(userId: string, actor: Actor, currentId: string) {
  await manageableUser(actor, userId);
  const now = new Date();
  const rows = await LoginSession.find({ userId, revokedAt: null, expiresAt: { $gt: now } }).sort({ createdAt: -1 }).lean();
  return rows.map((row) => plainSession(row as never, currentId));
}

export async function activeSessionCounts() {
  const now = new Date();
  const rows = await LoginSession.aggregate<{ _id: unknown; count: number }>([
    { $match: { revokedAt: null, expiresAt: { $gt: now } } },
    { $group: { _id: "$userId", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), row.count]));
}

export async function revokeLoginSession(userId: string, sessionId: string, actor: Actor) {
  await manageableUser(actor, userId);
  const row = await LoginSession.findOne({ _id: sessionId, userId, revokedAt: null });
  if (!row) throw new AppError(404, "NOT_FOUND", "That login is already ended.");
  row.revokedAt = new Date();
  await row.save();
  await writeAudit({ actor, action: "session.revoked", entity: "user", entityId: userId, newValue: { sessionId } });
  return { id: sessionId };
}

export async function revokeUserSessions(userId: string, actor: Actor) {
  const user = await manageableUser(actor, userId);
  const now = new Date();
  const result = await LoginSession.updateMany({ userId: user._id, revokedAt: null }, { $set: { revokedAt: now } });
  await writeAudit({ actor, action: "session.revoked_all", entity: "user", entityId: userId, newValue: { count: result.modifiedCount } });
  return { revoked: result.modifiedCount };
}
