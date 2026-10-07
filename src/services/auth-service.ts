import { cookies } from "next/headers";
import { AppError } from "@/lib/errors";
import { signSession, verifySession, SESSION_COOKIE, SESSION_MAX_AGE, sessionCookieOptions } from "@/lib/jwt";
import { can, type Permission, type Role } from "@/lib/permissions";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/user";
import { ensureBootstrap } from "@/services/bootstrap";
import { activeLoginSession, openLoginSession, revokeLoginSession } from "@/services/session-service";

export type Actor = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export function toActor(user: { _id: unknown; name: string; email: string; role: Role }): Actor {
  return { id: String(user._id), name: user.name, email: user.email, role: user.role };
}

export async function getSessionActor(): Promise<Actor | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await verifySession(token);
  if (!session) return null;
  await connectDB();
  const open = await activeLoginSession(session.sid, session.sub);
  if (!open) return null;
  const user = await User.findById(session.sub).lean<{ _id: unknown; name: string; email: string; role: Role; active: boolean }>();
  if (!user || !user.active) return null;
  return toActor(user);
}

export async function currentSessionId(): Promise<string> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return "";
  const session = await verifySession(token);
  return session?.sid || "";
}

export async function requireActor(permission?: Permission): Promise<Actor> {
  await connectDB();
  await ensureBootstrap();
  const actor = await getSessionActor();
  if (!actor) throw new AppError(401, "UNAUTHORIZED", "Sign in required.");
  if (permission && !can(actor.role, permission)) {
    throw new AppError(403, "FORBIDDEN", "You do not have permission to do that.");
  }
  return actor;
}

export async function createSessionCookie(actor: Actor, request: Request): Promise<void> {
  await connectDB();
  const sid = await openLoginSession(actor.id, request, new Date(Date.now() + SESSION_MAX_AGE * 1000));
  const token = await signSession({
    sub: actor.id,
    sid,
    role: actor.role,
    name: actor.name,
    email: actor.email,
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, sessionCookieOptions());
}

export async function clearSessionCookie(): Promise<void> {
  const sid = await currentSessionId();
  const actor = sid ? await getSessionActor() : null;
  if (sid && actor) {
    await revokeLoginSession(actor.id, sid, actor).catch(() => undefined);
  }
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
}
