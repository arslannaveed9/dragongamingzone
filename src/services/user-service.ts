import { AppError } from "@/lib/errors";
import { hashPassword } from "@/lib/password";
import { canManageRole, type Role } from "@/lib/permissions";
import { User } from "@/models/user";
import { writeAudit } from "@/services/audit-service";
import type { Actor } from "@/services/auth-service";
import { activeSessionCounts, revokeUserSessions } from "@/services/session-service";

function plain(
  user: { _id: unknown; name: string; email: string; role: Role; active: boolean; lastLoginAt?: Date | null },
  sessionCount = 0,
) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
    lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt).toISOString() : null,
    sessionCount,
  };
}

export async function listUsers() {
  const rows = await User.find().sort({ role: 1, name: 1 }).lean();
  const counts = await activeSessionCounts();
  return rows.map((row) => plain(row as never, counts.get(String((row as { _id: unknown })._id)) || 0));
}

export async function saveUser(
  id: string | null,
  input: { name: string; email: string; password?: string; role: Role; active?: boolean },
  actor: Actor,
) {
  if (!canManageRole(actor.role, input.role)) {
    throw new AppError(403, "FORBIDDEN", "You cannot assign that role.");
  }
  const email = input.email.trim().toLowerCase();
  if (id) {
    const existing = await User.findById(id);
    if (!existing) throw new AppError(404, "NOT_FOUND", "User not found.");
    if (!canManageRole(actor.role, existing.role as Role)) {
      throw new AppError(403, "FORBIDDEN", "You cannot edit that account.");
    }
    if (existing.role === "owner" && input.role !== "owner") {
      const owners = await User.countDocuments({ role: "owner", active: true, _id: { $ne: id } });
      if (owners === 0) throw new AppError(400, "LAST_OWNER", "Keep at least one active owner account.");
    }
    if (input.active === false && String(existing._id) === actor.id) {
      throw new AppError(400, "SELF", "You cannot deactivate your own account.");
    }
    const duplicate = await User.findOne({ email, _id: { $ne: id } });
    if (duplicate) throw new AppError(409, "DUPLICATE", "That email is already in use.");
    existing.name = input.name;
    existing.email = email;
    existing.role = input.role;
    existing.active = input.active ?? existing.active;
    const passwordChanged = Boolean(input.password);
    if (input.password) existing.passwordHash = await hashPassword(input.password);
    await existing.save();
    if (passwordChanged || existing.active === false) await revokeUserSessions(id, actor);
    await writeAudit({ actor, action: "user.updated", entity: "user", entityId: id, newValue: plain(existing) });
    return plain(existing);
  }
  if (!input.password) throw new AppError(400, "PASSWORD", "Set a password for the new account.");
  const duplicate = await User.findOne({ email });
  if (duplicate) throw new AppError(409, "DUPLICATE", "That email is already in use.");
  const created = await User.create({
    name: input.name,
    email,
    role: input.role,
    active: input.active ?? true,
    passwordHash: await hashPassword(input.password),
  });
  await writeAudit({ actor, action: "user.created", entity: "user", entityId: String(created._id), newValue: plain(created) });
  return plain(created);
}
